import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../lib/theme';
import {
  ALLERGY_OPTIONS,
  RESTRICTION_OPTIONS,
  SENSITIVITY_OPTIONS,
  SensitivityLevel,
  emptyProfile,
  saveProfile,
} from '../lib/profile';
import { Chip, PrimaryButton, Segmented, Toggle, SectionTitle, Screen } from '../components/ui';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [allergies, setAllergies] = useState<string[]>(['milk', 'wheat']);
  const [restrictions, setRestrictions] = useState<string[]>(['vegan', 'gluten_free']);
  const [avoid, setAvoid] = useState<string[]>(['아스파탐', '카페인']);
  const [draft, setDraft] = useState('');
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('strict');
  const [crossContam, setCrossContam] = useState(true);

  const addAvoid = () => {
    const v = draft.trim();
    if (v.length > 0 && !avoid.includes(v)) setAvoid([...avoid, v]);
    setDraft('');
  };

  const onSave = async () => {
    await saveProfile({
      ...emptyProfile(),
      allergies,
      restrictions,
      avoidIngredients: avoid,
      sensitivityLevel: sensitivity,
      checkCrossContamination: crossContam,
    });
    navigate('/', { replace: true });
  };

  return (
    <Screen>
      <div style={{ flex: 1, overflow: 'auto', padding: '60px 22px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.primary, letterSpacing: 0.4 }}>
          STEP 1 · 프로필 설정
        </div>
        <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.6, marginTop: 8, lineHeight: '33px', color: colors.ink }}>
          피해야 할 성분을
          <br />
          알려주세요
        </div>
        <div style={{ fontSize: 14, color: colors.grey500, marginTop: 9, lineHeight: '22px' }}>
          설정해두면 사진을 올릴 때마다 내 기준으로 자동 확인해드려요.
        </div>

        <SectionTitle style={{ marginTop: 24 }}>알레르기</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {ALLERGY_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              selected={allergies.includes(o.id)}
              onPress={() => setAllergies((p) => toggle(p, o.id))}
            />
          ))}
        </div>

        <SectionTitle style={{ marginTop: 24 }}>식이제한</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {RESTRICTION_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              label={o.label}
              selected={restrictions.includes(o.id)}
              onPress={() => setRestrictions((p) => toggle(p, o.id))}
            />
          ))}
        </div>

        <SectionTitle style={{ marginTop: 24 }}>직접 피하고 싶은 성분</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
          {avoid.map((a) => (
            <button
              key={a}
              onClick={() => setAvoid((p) => p.filter((x) => x !== a))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 12px 9px 14px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                background: colors.warningTint,
                color: colors.warningText,
                border: `1px solid ${colors.warningChipBorder}`,
              }}
            >
              {a}
              <span style={{ fontSize: 13, opacity: 0.7 }}>✕</span>
            </button>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addAvoid();
            }}
            onBlur={addAvoid}
            placeholder="＋ 직접 입력"
            style={{
              minWidth: 96,
              padding: '9px 14px',
              borderRadius: 999,
              fontSize: 14,
              color: colors.ink,
              background: colors.white,
              border: '1px dashed #CBD2D6',
              outline: 'none',
            }}
          />
        </div>

        <SectionTitle style={{ marginTop: 24 }}>민감도</SectionTitle>
        <div style={{ marginTop: 12 }}>
          <Segmented options={SENSITIVITY_OPTIONS} value={sensitivity} onChange={setSensitivity} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 18,
            padding: '14px 16px',
            background: colors.fill,
            borderRadius: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>교차오염 문구도 주의</div>
            <div style={{ fontSize: 12, color: colors.grey500, marginTop: 3 }}>
              "같은 시설에서 제조" 포함
            </div>
          </div>
          <Toggle value={crossContam} onChange={setCrossContam} />
        </div>
      </div>

      <div
        style={{
          padding: '12px 22px 30px',
          borderTop: `1px solid ${colors.lineSoft}`,
          background: colors.white,
        }}
      >
        <PrimaryButton title="저장하고 시작하기" onPress={onSave} />
      </div>
    </Screen>
  );
}
