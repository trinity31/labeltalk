// 보상형 광고 그룹 ID.
//
// 개발자가 테스트할 때(= dev 서버, import.meta.env.DEV)는 항상 테스트 광고를 띄워요.
// 그래야 실제 광고에 무효 트래픽(개발자 클릭/노출)이 쌓이지 않아요.
// 운영 빌드(ait build → import.meta.env.PROD)에서는 콘솔에서 발급한 실제 광고(VITE_AD_GROUP_ID)를 써요.
//
// 참고: fortune-cat은 getAnonymousKey(익명 키)로 "출시 앱에서도 개발자면 테스트 광고"를 구현했지만,
// web-framework 2.9.3의 WebView 환경에는 익명 키 API가 웹에서 노출되지 않아(모든 경로가 react-native 의존)
// 빌드 모드로 구분해요.
const TEST_AD_GROUP_ID = 'ait-ad-test-rewarded-id';

export const AD_GROUP_ID = import.meta.env.DEV
  ? TEST_AD_GROUP_ID
  : import.meta.env.VITE_AD_GROUP_ID || TEST_AD_GROUP_ID;
