// 사용자 행동 분석(Firebase Analytics) — 배포 후 퍼널/사용성 파악용.
// fortune-cat의 검증된 패턴을 따라요. VITE_FIREBASE_* 설정이 없으면 안전하게 아무 일도 하지 않아요(no-op).
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAnalytics,
  isSupported,
  logEvent as firebaseLogEvent,
  Analytics,
} from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let analytics: Analytics | null = null;

// 설정(measurementId)이 있을 때만 초기화해요. 미설정이면 track()이 콘솔 로그만 남겨요.
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isSupported()
    .then((ok) => {
      if (!ok) return;
      const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      analytics = getAnalytics(app);
    })
    .catch((err) => {
      console.warn('[analytics] 초기화 실패', err);
    });
}

export type EventParams = Record<string, string | number | boolean>;

// 이벤트 1건 기록. 설정이 없으면 콘솔에만 남겨 개발 중에도 흐름을 확인할 수 있어요.
export function track(name: string, params: EventParams = {}): void {
  if (analytics) {
    firebaseLogEvent(analytics, name, params);
  }
  console.log('[analytics]', name, params);
}
