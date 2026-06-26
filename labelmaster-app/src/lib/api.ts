// Firebase Functions(Gemini 2.5 Flash, structured output) 백엔드 연동.
// 지역/프로젝트가 바뀌면 이 URL만 교체하면 됩니다.
export const ANALYZE_URL =
  'https://us-central1-label-wizard-co50gj.cloudfunctions.net/analyzeImage';
// 자유 질문 응답 (이미 추출된 원재료 재사용, 사진 재분석 없음)
export const ASK_URL = ANALYZE_URL.replace('analyzeImage', 'askQuestion');

// LLM이 의미로 분류한 카테고리별 위험 성분 — 키워드 표에 없는 성분까지 포착해요.
export interface RiskFlags {
  non_vegan: string[]; // 확실한 동물성 (❌급)
  vegan_ambiguous: string[]; // 출처 불명확 (⚠️급)
  gluten: string[];
  milk: string[];
  egg: string[];
  nuts: string[];
  soy: string[];
  shellfish: string[];
  additives: string[];
}

export interface ExtractResult {
  name: string;
  ingredients: string[];
  flags: RiskFlags;
  rawAnswer: string; // 'yes' | 'no' | 'unknown'
  reason: string;
}

// 분석 실패 — rateLimited면 사용량 초과(429)예요.
export class AnalyzeError extends Error {
  rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = 'AnalyzeError';
    this.rateLimited = rateLimited;
  }
}

function emptyFlags(): RiskFlags {
  return {
    non_vegan: [],
    vegan_ambiguous: [],
    gluten: [],
    milk: [],
    egg: [],
    nuts: [],
    soy: [],
    shellfish: [],
    additives: [],
  };
}

// 원재료 추출 요청 — Gemini가 라벨 텍스트를 읽어 원재료 배열을 돌려줘요.
// 판단(✅/❌/⚠️)은 안전을 위해 클라이언트의 rules.ts에서 보수적으로 처리해요.
export async function extractIngredients(imageBase64: string): Promise<ExtractResult> {
  const res = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: imageBase64,
      question: '이 제품의 원재료를 모두 읽어서 알려주세요.',
    }),
  });

  if (!res.ok) {
    throw new AnalyzeError(`분석 서버 오류 (${res.status})`, res.status === 429);
  }

  const text = await res.text();
  const data = parseLoose(text);

  return {
    name: typeof data.name === 'string' ? data.name : '',
    ingredients: normalizeIngredients(data.ingredients),
    flags: {
      non_vegan: normalizeIngredients(data.flags_non_vegan),
      vegan_ambiguous: normalizeIngredients(data.flags_vegan_ambiguous),
      gluten: normalizeIngredients(data.flags_gluten),
      milk: normalizeIngredients(data.flags_milk),
      egg: normalizeIngredients(data.flags_egg),
      nuts: normalizeIngredients(data.flags_nuts),
      soy: normalizeIngredients(data.flags_soy),
      shellfish: normalizeIngredients(data.flags_shellfish),
      additives: normalizeIngredients(data.flags_additives),
    },
    rawAnswer: typeof data.answer === 'string' ? data.answer : 'unknown',
    reason: typeof data.reason === 'string' ? data.reason : '',
  };
}

// 백엔드가 structured output(response_schema)으로 항상 순수 JSON을 반환해요.
// 아래는 만약을 위한 방어적 파싱(혹시 코드펜스가 섞여도 객체를 복구)이에요.
function parseLoose(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fallthrough */
      }
    }
    return {};
  }
}

function normalizeIngredients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export interface CustomEvaluation {
  verdict: 'ok' | 'warning' | 'danger';
  title: string;
  reasons: string[];
}

// 자유 질문에 대한 LLM 응답 — 이미 추출된 원재료를 보내 사진 재분석 없이 답해요.
export async function askCustomQuestion(
  ingredients: string[],
  question: string,
  productName: string
): Promise<CustomEvaluation> {
  const res = await fetch(ASK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients, question, product_name: productName }),
  });
  if (!res.ok) {
    throw new AnalyzeError(`질문 응답 오류 (${res.status})`, res.status === 429);
  }
  const data = parseLoose(await res.text());
  const status = typeof data.status === 'string' ? data.status : 'warning';
  const verdict = status === 'ok' || status === 'danger' ? status : 'warning';
  return {
    verdict,
    title: typeof data.title === 'string' && data.title ? data.title : '확인이 필요해요',
    reasons: normalizeIngredients(data.reasons),
  };
}

// 샘플 사진 체험용 — 목업 F3의 예시 원재료. 네트워크 없이도 데모가 돌아가요.
export const SAMPLE_RESULT: ExtractResult = {
  name: '초코 비스킷',
  ingredients: [
    '밀가루',
    '설탕',
    '가공버터',
    '맥아추출물',
    '전지분유',
    '유청분말',
    '합성향료',
    '산도조절제',
  ],
  flags: {
    ...emptyFlags(),
    non_vegan: ['가공버터', '전지분유', '유청분말'],
    gluten: ['밀가루', '맥아추출물'],
    milk: ['가공버터', '전지분유', '유청분말'],
    additives: ['합성향료', '산도조절제'],
  },
  rawAnswer: 'no',
  reason: '밀가루, 전지분유 등이 포함되어 있어요.',
};
