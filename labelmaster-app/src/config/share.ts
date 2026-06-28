// 토스 공유 링크/미리보기 설정.
// 딥링크: 토스 앱에서 이 미니앱을 여는 경로 (콘솔 appName 기준).
export const TOSS_DEEP_LINK = 'intoss://can-i-eat-this';

// 외부(카카오·메신저 등) 공유 시 표시되는 OG 미리보기 이미지.
// 반드시 https:// 로 시작하는 절대경로여야 하며, 비워두면 토스 기본 미리보기가 사용돼요.
// 권장 규격은 토스 'OG 이미지 규칙' 문서를 따르세요(보통 1200×630).
export const OG_IMAGE_URL: string = import.meta.env.VITE_OG_IMAGE_URL || '';
