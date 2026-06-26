import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { colors } from '../lib/theme';
import { Profile, loadProfile, loadRecentQuestions, addRecentQuestion } from '../lib/profile';
import {
  AnalyzeError,
  ExtractResult,
  SAMPLE_RESULT,
  askCustomQuestion,
  extractIngredients,
} from '../lib/api';
import { evaluateProfile } from '../lib/rules';
import { runWithRewardedAd } from '../lib/ads';
import { track } from '../lib/analytics';
import { Screen, Spinner } from '../components/ui';

interface AnalyzeState {
  imageBase64?: string;
  sample?: boolean;
}

// '다른 질문'으로 돌아와 분석 화면이 다시 마운트돼도, 같은 사진이면
// LLM(extractIngredients)을 재호출하지 않도록 마지막 추출 결과를 캐시해요.
let extractionCache: { key: string; data: ExtractResult } | null = null;

export default function Analyze() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as AnalyzeState;
  const { imageBase64, sample } = state;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<ExtractResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [rateLimited, setRateLimited] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setProfile(await loadProfile());
      setRecentQuestions(await loadRecentQuestions());

      const key = sample ? 'sample' : imageBase64 ?? '';
      // 같은 사진으로 되돌아온 경우 → 캐시 재사용, LLM 재호출 안 함
      if (extractionCache && extractionCache.key === key) {
        if (alive) {
          setData(extractionCache.data);
          setStatus('done');
        }
        return;
      }

      try {
        if (sample) {
          extractionCache = { key, data: SAMPLE_RESULT };
          if (alive) {
            setData(SAMPLE_RESULT);
            setStatus('done');
          }
          return;
        }
        if (!imageBase64) {
          if (alive) setStatus('error');
          return;
        }
        // 실제 사진 분석(LLM)에는 보상형 광고를 함께 노출해요. (샘플·캐시 히트는 제외)
        const result = await runWithRewardedAd(() => extractIngredients(imageBase64));
        extractionCache = { key, data: result };
        track('analyze_done', { ingredient_count: result.ingredients.length });
        if (alive) {
          setData(result);
          setStatus('done');
        }
      } catch (e) {
        const limited = e instanceof AnalyzeError && e.rateLimited;
        track('analyze_error', { rate_limited: limited });
        if (alive) {
          setRateLimited(limited);
          setStatus('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [imageBase64, sample]);

  // 내 프로필 기준 확인 (룰 기반)
  const checkProfile = useCallback(() => {
    if (data == null || profile == null) return;
    const ev = evaluateProfile(data, profile);
    track('profile_check', { verdict: ev.verdict });
    navigate('/result', { state: { ...ev, productName: data.name } });
  }, [data, profile, navigate]);

  // 자유 질문 (LLM) — 입력창 제출 또는 최근 질문 버튼에서 호출
  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (data == null || q.length === 0 || asking) return;
      try {
        setAsking(true);
        // 질문 분석에는 광고를 띄우지 않아요. (비용이 큰 원재료 분석에만 광고를 노출)
        const ev = await askCustomQuestion(
          data.ingredients,
          q,
          data.name,
          profile?.sensitivityLevel ?? 'normal'
        );
        await addRecentQuestion(q); // 최근 질문에 저장
        track('custom_question', { verdict: ev.verdict });
        navigate('/result', {
          state: { ...ev, basisLabel: q, productName: data.name },
        });
      } catch (e) {
        alert(
          e instanceof AnalyzeError && e.rateLimited
            ? '지금 요청이 많아요. 잠시 후 다시 시도해 주세요.'
            : '질문에 답하지 못했어요. 다시 시도해 주세요.'
        );
      } finally {
        setAsking(false);
      }
    },
    [data, asking, navigate]
  );

  const previewSrc =
    imageBase64 && !sample
      ? imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`
      : null;

  return (
    <Screen>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 22px 24px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>원재료를 읽었어요</div>

        <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', height: 148 }}>
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="라벨"
              style={{ width: '100%', height: 148, objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'repeating-linear-gradient(45deg,#EEF1F2 0 12px,#E6EAEC 12px 24px)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: colors.grey400,
                  background: 'rgba(255,255,255,.75)',
                  padding: '6px 11px',
                  borderRadius: 7,
                }}
              >
                라벨 사진
              </span>
            </div>
          )}
        </div>

        {status === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <Spinner />
            <span style={{ fontSize: 14, color: colors.grey500 }}>원재료를 읽고 있어요…</span>
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: 16, background: colors.warningTint, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, color: colors.warningText, lineHeight: '21px', fontWeight: 600 }}>
              {rateLimited ? (
                <>
                  지금 분석 요청이 많아요.
                  <br />
                  잠시 후 다시 시도해 주세요.
                </>
              ) : (
                <>
                  원재료를 충분히 읽지 못했어요.
                  <br />
                  더 선명한 사진으로 다시 시도해 주세요.
                </>
              )}
            </div>
            <button
              onClick={() => navigate(-1)}
              style={{ marginTop: 12, background: 'none', border: 'none', fontSize: 13, fontWeight: 700, color: colors.primary, padding: 0 }}
            >
              ↻ 다시 올리기
            </button>
          </div>
        )}

        {status === 'done' && data != null && (
          <>
            <div
              style={{
                display: 'inline-flex',
                marginTop: 14,
                background: colors.primaryTint,
                color: colors.primary,
                fontSize: 12,
                fontWeight: 700,
                padding: '7px 12px',
                borderRadius: 999,
              }}
            >
              ● 추출 완료
            </div>
            <div style={{ marginTop: 10, background: colors.fill, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.grey500 }}>추출된 원재료</div>
              <div style={{ fontSize: 13.5, lineHeight: '24px', color: colors.grey700, marginTop: 8 }}>
                {data.name ? `${data.name} · ` : ''}
                {data.ingredients.join(', ')}
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 22 }}>무엇이 궁금하세요?</div>
            {profile != null && (
              <button
                onClick={checkProfile}
                style={{
                  width: '100%',
                  marginTop: 12,
                  background: colors.primary,
                  color: colors.white,
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 700,
                  padding: '15px 16px',
                  borderRadius: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>내 프로필 기준으로 확인</span>
                <span style={{ opacity: 0.8 }}>›</span>
              </button>
            )}

            <div style={{ fontSize: 12, fontWeight: 600, color: colors.grey300, margin: '16px 0 10px' }}>
              또는 직접 질문하기
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={customQ}
                onChange={(e) => setCustomQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') ask(customQ);
                }}
                placeholder="예: 땅콩 있어? 임산부가 먹어도 돼?"
                disabled={asking}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '13px 14px',
                  borderRadius: 12,
                  border: `1px solid ${colors.line}`,
                  background: colors.white,
                  fontSize: 14,
                  color: colors.ink,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => ask(customQ)}
                disabled={asking || customQ.trim().length === 0}
                style={{
                  flexShrink: 0,
                  padding: '0 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: colors.primary,
                  color: colors.white,
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: asking || customQ.trim().length === 0 ? 0.5 : 1,
                }}
              >
                {asking ? '…' : '질문'}
              </button>
            </div>

            {/* 최근에 한 질문 (사용자별, 최대 4개) */}
            {recentQuestions.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: colors.grey300, margin: '6px 0 10px' }}>
                  최근 질문
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  {recentQuestions.slice(0, 4).map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      disabled={asking}
                      style={{
                        padding: '13px 14px',
                        borderRadius: 12,
                        border: `1px solid ${colors.line}`,
                        background: colors.white,
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.ink,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => navigate(-1)}
              style={{
                display: 'block',
                margin: '18px auto 0',
                background: 'none',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                color: colors.grey300,
              }}
            >
              ↻ 다른 사진으로 다시 올리기
            </button>
          </>
        )}
      </div>

      {/* 자유/프리셋 질문 진행 중 — 전체 로딩 오버레이로 진행 상태를 명확히 표시 */}
      {asking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: 'rgba(255,255,255,.82)',
          }}
        >
          <Spinner />
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.grey600 }}>
            질문을 확인하고 있어요…
          </div>
        </div>
      )}
    </Screen>
  );
}
