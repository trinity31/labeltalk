import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../lib/theme';
import { track } from '../lib/analytics';
import { PrimaryButton, Screen } from '../components/ui';

// 사용자가 제공하는 라벨 샘플 이미지 (public/tutorial-label.jpg). 없으면 플레이스홀더로 대체.
const SAMPLE_IMG = '/tutorial-label.jpg';

const TOTAL = 4;

export default function Intro() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [imgError, setImgError] = useState(false);

  const finish = (skipped: boolean) => {
    track('intro_start', { skipped });
    navigate('/onboarding');
  };
  const next = () => (step < TOTAL - 1 ? setStep(step + 1) : finish(false));

  return (
    <Screen>
      {/* 상단: 진행 도트 + 건너뛰기 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px 6px',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 22 : 7,
                height: 7,
                borderRadius: 999,
                background: i === step ? colors.primary : colors.line,
                transition: 'width .2s',
              }}
            />
          ))}
        </div>
        {step < TOTAL - 1 && (
          <button
            onClick={() => finish(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              color: colors.grey400,
            }}
          >
            건너뛰기
          </button>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 24px 12px' }}>
        {step === 1 && (
          <StepLayout
            n={2}
            title={'이런 라벨 사진을\n올리기만 하면 돼요'}
            desc="제품 뒷면 원재료표가 또렷하게 보이게 찍어주세요"
          >
            <div
              style={{
                marginTop: 22,
                borderRadius: 18,
                overflow: 'hidden',
                border: `1px solid ${colors.line}`,
                boxShadow: '0 10px 26px rgba(24,24,27,.10)',
                position: 'relative',
                background: colors.fill,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  zIndex: 1,
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.white,
                  background: 'rgba(24,24,27,.62)',
                  padding: '5px 9px',
                  borderRadius: 999,
                }}
              >
                📷 라벨 사진
              </span>
              {imgError ? (
                <div
                  style={{
                    height: 300,
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
                      background: 'rgba(255,255,255,.8)',
                      padding: '7px 12px',
                      borderRadius: 8,
                    }}
                  >
                    라벨 사진
                  </span>
                </div>
              ) : (
                <img
                  src={SAMPLE_IMG}
                  alt="라벨 샘플 사진"
                  onError={() => setImgError(true)}
                  style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }}
                />
              )}
            </div>
          </StepLayout>
        )}

        {step === 2 && (
          <StepLayout
            n={3}
            title={'흐릿한 글씨도\n대신 읽어드려요'}
            desc="AI가 원재료를 또박또박 추출해줘요"
          >
            <div
              style={{
                marginTop: 22,
                background: colors.surfaceSoft,
                border: `1px solid ${colors.line}`,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
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
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.grey500, marginTop: 14 }}>
                추출된 원재료
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: '25px',
                  color: colors.grey700,
                  marginTop: 8,
                }}
              >
                데일리 콤부 워터 피치 · 무수구연산, 에리스리톨, 콤부차분말, 사탕수수당, 녹차(국산),
                복숭아과즙분말, 복숭아(국산), 식물성크림혼합분말, 유산균
              </div>
            </div>
          </StepLayout>
        )}

        {step === 3 && (
          <StepLayout
            n={4}
            title={'먹어도 되는지\n한마디로 답해요'}
            desc="내 프로필 기준으로 ✅·⚠️·❌와 근거를 보여드려요"
          >
            <div
              style={{
                marginTop: 22,
                borderRadius: 18,
                overflow: 'hidden',
                border: `1px solid ${colors.warningChipBorder}`,
                boxShadow: '0 10px 26px rgba(24,24,27,.08)',
              }}
            >
              <div
                style={{
                  background: `linear-gradient(180deg, ${colors.warningTint}, #F8EAC8)`,
                  padding: '26px 18px 22px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 50, lineHeight: 1 }}>⚠️</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: colors.ink,
                    marginTop: 10,
                    letterSpacing: -0.5,
                  }}
                >
                  확인이 필요해요
                </div>
              </div>
              <div style={{ background: colors.white, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.grey500 }}>
                  이 성분 때문이에요
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['우유가 들어있어요', '대두가 들어있어요', '복숭아가 들어있어요'].map((t) => (
                    <div
                      key={t}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        background: colors.fill,
                        borderRadius: 12,
                        padding: '12px 14px',
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: colors.ink,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: colors.warning,
                          flexShrink: 0,
                        }}
                      />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </StepLayout>
        )}

        {step === 0 && (
          <StepLayout
            n={1}
            title={'먼저 내 프로필을\n등록해요'}
            desc="알레르기·식이제한을 한 번만 설정하면 매번 자동으로 확인해드려요"
          >
            <div
              style={{
                marginTop: 22,
                background: colors.surfaceSoft,
                border: `1px solid ${colors.line}`,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <ProfileMock
                label="알레르기"
                items={[
                  { t: '우유', on: true },
                  { t: '대두', on: true },
                  { t: '복숭아', on: true },
                  { t: '계란', on: false },
                  { t: '땅콩', on: false },
                ]}
              />
              <div style={{ marginTop: 16 }}>
                <ProfileMock
                  label="식이제한"
                  items={[
                    { t: '비건', on: true },
                    { t: '글루텐 제한', on: false },
                  ]}
                />
              </div>
            </div>
          </StepLayout>
        )}
      </div>

      {/* 하단 버튼 */}
      <div style={{ padding: '10px 22px 30px', background: colors.white }}>
        <PrimaryButton
          title={step < TOTAL - 1 ? '다음' : '시작하기'}
          onPress={next}
          style={{ padding: 17 }}
        />
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{
              display: 'block',
              margin: '12px auto 0',
              background: 'none',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              color: colors.grey400,
            }}
          >
            이전
          </button>
        )}
      </div>
    </Screen>
  );
}

// 프로필 등록 미리보기 — 온보딩 칩과 동일한 룩의 정적 목업
function ProfileMock({ label, items }: { label: string; items: { t: string; on: boolean }[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.ink }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
        {items.map((it) => (
          <span
            key={it.t}
            style={{
              padding: '8px 13px',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: it.on ? 600 : 500,
              background: it.on ? colors.primaryTint : colors.fill,
              color: it.on ? colors.primary : colors.grey600,
              border: `1px solid ${it.on ? colors.primaryChipBorder : 'transparent'}`,
            }}
          >
            {it.on ? '✓ ' : ''}
            {it.t}
          </span>
        ))}
      </div>
    </div>
  );
}

// 스텝 공통 레이아웃 — 번호 배지 + 제목 + 설명 + 비주얼(children)
function StepLayout({
  n,
  title,
  desc,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          background: colors.primary,
          color: colors.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 800,
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: -0.7,
          lineHeight: '34px',
          marginTop: 14,
          color: colors.ink,
        }}
      >
        {title.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < title.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 15, color: colors.grey500, marginTop: 9, lineHeight: '22px' }}>
        {desc}
      </div>
      {children}
    </div>
  );
}
