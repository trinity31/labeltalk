# GA4 일일 통계 대시보드

`ga4-report.mjs`는 Google Analytics Data API로 GA4 이벤트를 집계해
`analytics/dashboard.html` 대시보드를 만들고 `analytics/history.json`에 추세를 누적합니다.

## 1. 사전 준비 (최초 1회)

### (1) GA4 속성 ID 확인
GA4 → **관리 → 속성 설정 → 속성 ID** (숫자, 예: `123456789`).
> `measurementId`(G-XXXX)와 다릅니다.

### (2) 서비스 계정 키 발급
GCP 콘솔(`label-wizard-co50gj`) → IAM 및 관리자 → 서비스 계정 →
계정 생성(또는 기존 사용) → **키 추가 → JSON** 다운로드.

### (3) GA4에 뷰어 권한 부여
GA4 → **관리 → 속성 액세스 관리 → +** → 위 서비스 계정 이메일
(`...@label-wizard-co50gj.iam.gserviceaccount.com`)을 **뷰어**로 추가.

### (4) `.env` 설정
`labelmaster-app/.env`에 추가:
```
GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/절대경로/service-account.json
```

### (5) 프로필 항목 분포를 보려면 커스텀 측정기준 등록 (선택)
`profile_item`의 항목별 분포(`알레르기/식이제한` 분해)를 보려면 GA4에서
**관리 → 맞춤 정의 → 맞춤 측정기준 만들기**로 이벤트 매개변수
`type`, `label`을 각각 등록하세요. (등록 전이면 그 표만 비고 나머지는 정상 동작)

## 2. 실행

```bash
npm run report               # 어제 하루
npm run report -- 2026-06-25 # 특정 날짜
npm run report -- 7daysAgo today  # 범위 지정
```

결과: `analytics/dashboard.html` (브라우저로 열기), `analytics/history.json` (추세 데이터).

## 3. 매일 자동 실행 (cron)

`crontab -e`에 추가 — 매일 오전 9시에 어제 통계 생성:
```cron
0 9 * * * cd /Users/trinity/Projects/LabelMaster/labelmaster-app && /usr/local/bin/node scripts/ga4-report.mjs >> analytics/cron.log 2>&1
```
> `node` 경로는 `which node`로 확인해 맞추세요. (nvm 사용 시 절대경로 필요)

macOS에서 더 안정적으로는 **launchd**(`~/Library/LaunchAgents/*.plist`,
`StartCalendarInterval`)를 쓸 수 있습니다.

> GA4는 데이터 확정에 최대 ~48시간이 걸릴 수 있어, "어제" 집계는 이후 소폭 변동할 수 있습니다.
> 필요하면 2일 전 날짜로 돌리거나, 다음 날 한 번 더 실행해 같은 날짜를 덮어쓰세요.
