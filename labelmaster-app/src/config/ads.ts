// 보상형 광고 그룹 ID.
// 개발/샌드박스는 테스트 광고(ait-ad-test-rewarded-id)를 쓰고,
// 운영은 앱인토스 콘솔에서 발급한 ait.live... 를 VITE_AD_GROUP_ID 로 주입해요.
export const AD_GROUP_ID = import.meta.env.VITE_AD_GROUP_ID || 'ait-ad-test-rewarded-id';
