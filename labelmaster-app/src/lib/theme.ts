// 디자인 토큰 — 목업의 "디자인 시스템" 범례에서 그대로 추출했어요.
export const colors = {
  // 브랜드 / 상태
  primary: '#1F8A5B',
  primaryTint: '#EAF5EF',
  primaryTintBorder: '#D6EBE0',
  primaryChipBorder: '#BFE3D0',

  warning: '#E0A327',
  warningText: '#A57910',
  warningTint: '#FBF3DF',
  warningChipBorder: '#EBD9A8',

  danger: '#C0392B',
  dangerDot: '#D64545',
  dangerTint: '#FBECEC',

  // 잉크 / 그레이
  ink: '#18181B',
  grey700: '#3F4348',
  grey600: '#494E54',
  grey500: '#6B7177',
  grey400: '#8A9097',
  grey300: '#9AA0A6',
  fill: '#F5F6F7',
  fillAlt: '#F2F4F5',
  line: '#E5E8EA',
  lineSoft: '#F0F2F3',
  surfaceSoft: '#FAFBFB',
  white: '#FFFFFF',
} as const;

// 상태 → 색/그라데이션/아이콘 매핑
export type Verdict = 'ok' | 'warning' | 'danger';

export const verdictStyle: Record<
  Verdict,
  { icon: string; accent: string; gradTop: string; gradBottom: string; dot: string }
> = {
  ok: {
    icon: '✅',
    accent: colors.primary,
    gradTop: '#EAF5EF',
    gradBottom: '#D6EDE0',
    dot: colors.primary,
  },
  warning: {
    icon: '⚠️',
    accent: colors.warningText,
    gradTop: '#FBF3DF',
    gradBottom: '#F8EAC8',
    dot: colors.warning,
  },
  danger: {
    icon: '❌',
    accent: colors.danger,
    gradTop: '#FBECEC',
    gradBottom: '#F6D9D9',
    dot: colors.dangerDot,
  },
};

export const radius = { sm: 10, md: 12, lg: 14, xl: 16, pill: 999 } as const;

// 면책 고지 (PRD 7.6 필수 문구)
export const DISCLAIMER =
  '참고용 안내입니다. 알레르기·건강 관련 판단은 실제 제품 라벨과 제조사 안내를 반드시 직접 확인해 주세요.';
