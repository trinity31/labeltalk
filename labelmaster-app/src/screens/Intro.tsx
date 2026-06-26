import { useNavigate } from 'react-router-dom';
import { colors } from '../lib/theme';
import { PrimaryButton, Screen } from '../components/ui';

const STEPS = [
  {
    icon: '📷',
    bg: colors.primaryTint,
    title: '라벨 사진 올리기',
    desc: '원재료표를 찍어서 올리기만 하면 돼요',
    connector: true,
  },
  {
    icon: '🔍',
    bg: colors.warningTint,
    title: '내 기준으로 자동 확인',
    desc: '비건·알레르기·첨가물을 대신 읽어드려요',
    connector: true,
  },
  {
    icon: '✅',
    bg: colors.primaryTint,
    title: '한마디로 답해드려요',
    desc: '✅ 괜찮아요 · ⚠️ 확인해요 · ❌ 피하세요',
    connector: false,
  },
];

export default function Intro() {
  const navigate = useNavigate();

  return (
    <Screen>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px 12px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.9, lineHeight: '38px' }}>
          라벨만 찍으면
          <br />
          <span style={{ color: colors.primary }}>먹어도 되는지</span> 알려줘요
        </div>
        <div style={{ fontSize: 15, color: colors.grey300, marginTop: 10, lineHeight: '22px' }}>
          원재료표 사진 한 장이면 충분해요
        </div>

        {/* 히어로 아이콘 */}
        <div
          style={{
            margin: '22px auto 0',
            width: 150,
            height: 150,
            borderRadius: 36,
            background: 'linear-gradient(160deg,#2EA56E,#1F8A5B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 16px 34px rgba(31,138,91,.32)',
          }}
        >
          <div style={{ fontSize: 76, lineHeight: 1 }}>🍽️</div>
        </div>

        {/* 3단계 안내 */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column' }}>
          {STEPS.map((s) => (
            <div key={s.title} style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: s.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 21,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                {s.connector && (
                  <div
                    style={{
                      flex: 1,
                      width: 2,
                      borderLeft: '2px dashed #DDE2E5',
                      margin: '5px 0',
                      minHeight: 22,
                    }}
                  />
                )}
              </div>
              <div style={{ paddingTop: 4, paddingBottom: s.connector ? 0 : 4 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: colors.grey300, marginTop: 4, lineHeight: '20px' }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 22px 30px', background: colors.white }}>
        <PrimaryButton
          title="시작하기"
          onPress={() => navigate('/onboarding')}
          style={{ padding: 17 }}
        />
      </div>
    </Screen>
  );
}
