import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { colors } from '../lib/theme';
import { Profile, loadProfile } from '../lib/profile';
import { AnalyzeError, ExtractResult, SAMPLE_RESULT, extractIngredients } from '../lib/api';
import { PRESETS, PresetKey, evaluatePreset, evaluateProfile } from '../lib/rules';
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

  useEffect(() => {
    let alive = true;
    (async () => {
      setProfile(await loadProfile());

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
        const result = await extractIngredients(imageBase64);
        extractionCache = { key, data: result };
        if (alive) {
          setData(result);
          setStatus('done');
        }
      } catch (e) {
        if (alive) {
          setRateLimited(e instanceof AnalyzeError && e.rateLimited);
          setStatus('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [imageBase64, sample]);

  const goResult = useCallback(
    (target: PresetKey | 'profile') => {
      if (data == null) return;
      const ev =
        target === 'profile' && profile != null
          ? evaluateProfile(data, profile)
          : evaluatePreset(data, target as PresetKey);
      navigate('/result', {
        state: { ...ev, productName: data.name },
      });
    },
    [data, profile, navigate]
  );

  const previewSrc =
    imageBase64 && !sample
      ? imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`
      : null;

  return (
    <Screen>
      <div style={{ flex: 1, overflow: 'auto', padding: '60px 22px 24px' }}>
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
                onClick={() => goResult('profile')}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => goResult(p.key)}
                  style={{
                    padding: '13px 14px',
                    borderRadius: 12,
                    border: `1px solid ${colors.line}`,
                    background: colors.white,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.ink,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

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
    </Screen>
  );
}
