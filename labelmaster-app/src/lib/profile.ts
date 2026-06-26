import { Storage } from '@apps-in-toss/web-framework';

// PRD 7.1 프로필 데이터 모델
export type SensitivityLevel = 'strict' | 'normal' | 'light';

export interface Profile {
  allergies: string[]; // 알레르기 항목 id
  restrictions: string[]; // 식이제한 id
  avoidIngredients: string[]; // 직접 입력한 성분
  sensitivityLevel: SensitivityLevel;
  checkCrossContamination: boolean;
}

// 온보딩 화면 선택지 (목업 F1 기준)
export const ALLERGY_OPTIONS = [
  { id: 'milk', label: '우유/유제품' },
  { id: 'egg', label: '계란' },
  { id: 'tree_nuts', label: '견과류' },
  { id: 'wheat', label: '밀/글루텐' },
  { id: 'soy', label: '대두' },
  { id: 'shellfish', label: '갑각류/해산물' },
] as const;

export const RESTRICTION_OPTIONS = [
  { id: 'vegan', label: '비건' },
  { id: 'lactose_free', label: '락토프리' },
  { id: 'gluten_free', label: '글루텐 제한' },
] as const;

export const SENSITIVITY_OPTIONS: { id: SensitivityLevel; label: string }[] = [
  { id: 'strict', label: '매우 민감' },
  { id: 'normal', label: '보통' },
  { id: 'light', label: '가볍게' },
];

const STORAGE_KEY = 'labelmaster:profile:v1';

export const emptyProfile = (): Profile => ({
  allergies: [],
  restrictions: [],
  avoidIngredients: [],
  sensitivityLevel: 'normal',
  checkCrossContamination: false,
});

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    if (raw == null) {
      return null;
    }
    return { ...emptyProfile(), ...JSON.parse(raw) } as Profile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await Storage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function clearProfile(): Promise<void> {
  await Storage.removeItem(STORAGE_KEY);
}

// 메인 홈의 프로필 요약 문구 (예: "비건 · 우유 알레르기 · 글루텐 제한")
export function profileSummary(profile: Profile): string {
  const parts: string[] = [];
  for (const r of RESTRICTION_OPTIONS) {
    if (profile.restrictions.includes(r.id)) parts.push(r.label);
  }
  for (const a of ALLERGY_OPTIONS) {
    if (profile.allergies.includes(a.id)) parts.push(`${a.label} 알레르기`);
  }
  parts.push(...profile.avoidIngredients);
  return parts.length > 0 ? parts.join(' · ') : '설정된 기준이 없어요';
}
