# 이거먹어도돼? — 토스 미니앱 (WebView)

식품 라벨 사진을 올리면 원재료를 읽어 **✅ / ❌ / ⚠️ 한 줄 결론**으로 답해주는 앱인토스(WebView) 미니앱입니다.
Claude Design의 `이거먹어도돼.dc.html` 목업과 `PRD.md`를 구현했어요.

## 스택

- **WebView**: `@apps-in-toss/web-framework` + **Vite** + **React DOM** + react-router-dom
- 다른 작동 앱들(fortune-cat 등)과 동일한 검증된 구성

## 화면

| 라우트 | 화면 |
|--------|------|
| `/` | 메인 홈(프로필 요약·사진 업로드·샘플 체험) |
| `/onboarding` | 프로필 설정(알레르기·식이제한·회피 성분·민감도·교차오염) |
| `/analyze` | 원재료 추출 + 프리셋 질문 |
| `/result` | 결과 카드(✅/❌/⚠️) |

## 아키텍처

- **OCR/원재료 추출**: Firebase Functions(Gemini 2.5 Flash) `analyzeImage` 호출 — `src/lib/api.ts`
  - 배포 완료: `https://us-central1-label-wizard-co50gj.cloudfunctions.net/analyzeImage`
- **판정(✅/❌/⚠️)**: 안전을 위해 클라이언트에서 PRD 8.2 키워드 룰로 **보수적으로** 결정 — `src/lib/rules.ts`
- **프로필 저장**: `@apps-in-toss/web-framework`의 `Storage`(로컬) — `src/lib/profile.ts`
- **사진 입력**: `fetchAlbumPhotos`(앨범 권한) — `src/screens/Home.tsx`
- **공유**: `navigator.share` → 실패 시 클립보드 복사 fallback

## 실행

```bash
npm install
npm run dev          # granite dev → Vite (포트 5173)
```

토스 샌드박스 앱에서 `intoss://can-i-eat-this` 로 접속해 테스트합니다.

> `granite.config.ts`의 `web.host`는 개발 PC의 LAN IP(현재 `192.168.35.40`)입니다. 네트워크가 바뀌면 `ipconfig getifaddr en0` 값으로 바꿔주세요.

## 빌드/배포

```bash
npm run build        # ait build → dist/ + .ait
```

- `appName`은 앱인토스 콘솔 등록명(`can-i-eat-this`)과 일치해야 샌드박스에서 로드됩니다.
- 백엔드 함수 URL이 바뀌면 `src/lib/api.ts`의 `ANALYZE_URL`만 교체하세요.
