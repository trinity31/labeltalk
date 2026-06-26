import { AD_GROUP_ID } from '../config/ads';

// 광고가 안 뜨거나 응답이 없어도 분석은 막지 않도록 하는 안전 타임아웃
const AD_TIMEOUT_MS = 8000;

// 보상형 광고를 1회 표시해요. (web-framework 2.x WebView API: loadFullScreenAd/showFullScreenAd)
// 광고가 닫히거나(보상 여부 무관) 실패/미지원/타임아웃이면 resolve 해서 분석을 진행하게 해요.
export function showRewardedAdOnce(): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    let cleanupLoad: (() => void) | undefined;
    let cleanupShow: (() => void) | undefined;

    const timer = setTimeout(() => {
      console.log('[ads] timeout');
      settle();
    }, AD_TIMEOUT_MS);

    function settle() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        cleanupShow?.();
        cleanupLoad?.();
      } catch {
        /* noop */
      }
      resolve();
    }

    (async () => {
      try {
        const { loadFullScreenAd, showFullScreenAd } = await import('@apps-in-toss/web-framework');
        const loadSupported = loadFullScreenAd.isSupported?.();
        console.log('[ads] adGroupId:', AD_GROUP_ID, '| loadSupported:', loadSupported);

        if (loadSupported === false) {
          console.warn('[ads] 광고가 지원되지 않는 환경');
          settle();
          return;
        }

        cleanupLoad = loadFullScreenAd({
          options: { adGroupId: AD_GROUP_ID },
          onEvent: (event) => {
            console.log('[ads] load event:', event.type);
            if (event.type !== 'loaded') return;
            cleanupShow = showFullScreenAd({
              options: { adGroupId: AD_GROUP_ID },
              onEvent: (e) => {
                console.log('[ads] show event:', e.type);
                if (e.type === 'userEarnedReward') {
                  console.log('[ads] 보상 획득');
                }
                if (e.type === 'dismissed' || e.type === 'failedToShow') {
                  settle();
                }
              },
              onError: (err) => {
                console.error('[ads] show error', err);
                settle();
              },
            });
          },
          onError: (err) => {
            console.error('[ads] load error', err);
            settle();
          },
        });
      } catch (err) {
        console.error('[ads] 모듈 로드 실패', err);
        settle();
      }
    })();
  });
}

// LLM 호출(task)과 보상형 광고를 병렬 실행하고, 둘 다 끝나면 task 결과를 반환해요.
// 광고가 실패/미지원이어도 task 결과는 정상 반환하고, task가 실패하면 그 에러를 그대로 던져요.
export async function runWithRewardedAd<T>(task: () => Promise<T>): Promise<T> {
  const [result] = await Promise.all([task(), showRewardedAdOnce().catch(() => undefined)]);
  return result;
}
