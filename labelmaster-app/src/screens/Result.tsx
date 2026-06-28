import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { colors, verdictStyle, Verdict, DISCLAIMER } from '../lib/theme';
import { track } from '../lib/analytics';
import { TOSS_DEEP_LINK, OG_IMAGE_URL } from '../config/share';
import { Screen } from '../components/ui';

interface ResultState {
  verdict: Verdict;
  basisLabel: string;
  title: string;
  reasons: string[];
  productName?: string;
}

export default function Result() {
  const navigate = useNavigate();
  const state = useLocation().state as ResultState | null;

  useEffect(() => {
    if (state != null) track('result_view', { verdict: state.verdict });
  }, [state]);

  if (state == null) {
    navigate('/', { replace: true });
    return null;
  }

  const { verdict, basisLabel, title, reasons, productName } = state;
  const v = verdictStyle[verdict];
  const hasReasons = reasons.length > 0;

  const onShare = useCallback(async () => {
    track('share_clicked', { verdict });
    const flatTitle = title.replace(/\n/g, ' ');
    const message = [
      '이거먹어도돼? 결과',
      `${v.icon} ${flatTitle}`,
      hasReasons ? `근거: ${reasons.join(', ')}` : null,
      '참고용이며 실제 라벨을 직접 확인해 주세요.',
    ]
      .filter(Boolean)
      .join('\n');

    // 1순위: 토스 공유 링크(+OG 미리보기). 외부로 공유되면 OG 이미지가 노출돼요.
    try {
      const { getTossShareLink, share } = await import('@apps-in-toss/web-framework');
      const tossLink = await getTossShareLink(TOSS_DEEP_LINK, OG_IMAGE_URL || undefined);
      await share({ message: `${message}\n${tossLink}` });
      return;
    } catch {
      /* 토스 환경이 아니거나 실패 → 웹 공유로 폴백 */
    }

    // 폴백: 일반 웹 공유/복사 (데스크톱 브라우저 등)
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        alert('결과를 복사했어요.');
      }
    } catch {
      /* 공유 취소/실패 시에도 앱이 멈추지 않도록 무시 */
    }
  }, [title, v.icon, hasReasons, reasons, verdict]);

  return (
    <Screen>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            background: `linear-gradient(180deg, ${v.gradTop}, ${v.gradBottom})`,
            padding: '64px 22px 30px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 62, lineHeight: 1 }}>{v.icon}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: v.accent, marginTop: 14, letterSpacing: 0.3 }}>
            {basisLabel}
          </div>
          <div
            style={{
              fontSize: 27,
              fontWeight: 800,
              color: colors.ink,
              marginTop: 8,
              letterSpacing: -0.7,
              lineHeight: '35px',
            }}
          >
            {title.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < title.split('\n').length - 1 && <br />}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.grey500 }}>
            {hasReasons ? '이 성분 때문이에요' : '확인 결과'}
          </div>
          <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hasReasons ? (
              reasons.map((r, i) => <ReasonRow key={`${r}-${i}`} dot={v.dot} text={r} />)
            ) : (
              <ReasonRow dot={colors.primary} text="읽힌 원재료 기준 문제 성분이 보이지 않아요" />
            )}
          </div>

          <div
            style={{
              marginTop: 16,
              background: colors.surfaceSoft,
              border: `1px solid ${colors.lineSoft}`,
              borderRadius: 12,
              padding: '13px 14px',
              fontSize: 12,
              color: colors.grey400,
              lineHeight: '19px',
            }}
          >
            {DISCLAIMER}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                flex: 1,
                background: colors.white,
                color: colors.grey600,
                border: `1px solid ${colors.line}`,
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                padding: 15,
              }}
            >
              다른 질문
            </button>
            <button
              onClick={onShare}
              style={{
                flex: 1.4,
                background: colors.primary,
                color: colors.white,
                border: 'none',
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                padding: 15,
              }}
            >
              공유하기
            </button>
          </div>

          {productName ? (
            <div style={{ fontSize: 12, color: colors.grey300, marginTop: 16, textAlign: 'center' }}>
              {productName}
            </div>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}

function ReasonRow({ dot, text }: { dot: string; text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: colors.fill,
        borderRadius: 12,
        padding: '13px 15px',
        fontSize: 15,
        fontWeight: 600,
        color: colors.ink,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {text}
    </div>
  );
}
