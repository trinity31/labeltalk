import { Verdict } from './theme';
import {
  Profile,
  ALLERGY_OPTIONS,
  RESTRICTION_OPTIONS,
} from './profile';
import { ExtractResult, RiskFlags } from './api';

// 알레르기 id → LLM 플래그 카테고리 (키워드 표에 없는 성분 보완)
const ALLERGY_FLAG: Record<string, keyof RiskFlags> = {
  milk: 'milk',
  egg: 'egg',
  tree_nuts: 'nuts',
  peanut: 'nuts',
  wheat: 'gluten',
  soy: 'soy',
  shellfish: 'shellfish',
};

// PRD 8.2 — 보수적 판단을 위한 키워드 테이블.
// '락토'는 프락토올리고당·갈락토올리고당에 오매칭되므로 빼고, 실제 우유 성분(유당/락토페린)으로 대체.
const MILK = ['우유', '유제품', '분유', '전지분유', '탈지분유', '유청', '버터', '치즈', '크림', '카제인', '카세인', '유당', '락토페린'];
const EGG = ['계란', '달걀', '난백', '난황', '전란', '난류'];
const NUTS = ['견과', '아몬드', '호두', '캐슈', '피스타치오', '마카다미아', '헤이즐넛', '잣'];
const PEANUT = ['땅콩', '낙화생'];
const WHEAT_GLUTEN = ['밀', '밀가루', '소맥', '소맥분', '글루텐', '보리', '맥아', '맥아추출물', '호밀'];
const BUCKWHEAT = ['메밀'];
const SOY = ['대두', '콩', '간장', '된장', '두부', '레시틴'];
const SHELLFISH = ['새우', '게', '가재', '랍스터', '조개', '굴', '오징어', '문어', '갑각', '어패', '홍합', '전복'];
const MACKEREL = ['고등어'];
const PORK = ['돼지', '돈육', '라드', '베이컨', '햄'];
const BEEF = ['쇠고기', '소고기', '우육', '사골'];
const CHICKEN = ['닭', '계육', '치킨'];
const PEACH = ['복숭아'];
const TOMATO = ['토마토'];
const SULFITES = ['아황산', '메타중아황산', '이산화황'];

// 식이제한용 — 육류/해산물 묶음
const MEAT = ['쇠고기', '소고기', '우육', '사골', '돼지고기', '돈육', '닭고기', '계육', '오리고기', '양고기', '육수', '젤라틴', '라드', '베이컨', '햄', '소시지', '벌꿀', '꿀'];
const SEAFOOD = ['생선', '어육', '멸치', '가다랑어', '참치', '연어', '고등어', '명태', '대구', '액젓', '젓갈', '새우', '게', '오징어', '문어', '낙지', '조개', '굴', '홍합', '전복', '어묵', '맛살'];

// 알레르기 id → 위험 키워드
const ALLERGY_KEYWORDS: Record<string, string[]> = {
  milk: MILK,
  egg: EGG,
  tree_nuts: NUTS,
  peanut: PEANUT,
  wheat: WHEAT_GLUTEN,
  buckwheat: BUCKWHEAT,
  soy: SOY,
  shellfish: SHELLFISH,
  mackerel: MACKEREL,
  pork: PORK,
  beef: BEEF,
  chicken: CHICKEN,
  peach: PEACH,
  tomato: TOMATO,
  sulfites: SULFITES,
};

// 비건 위반 — 명확한 동물성(❌급)
const VEGAN_BLOCK = [...MILK, ...EGG, ...MEAT, ...SEAFOOD];
// 비건 — 출처 불명(⚠️급)
// 일반 향료(향료/천연향료)는 시판 가공식품에서 거의 식물성·합성이라 과판정만 유발해 제외했어요.
// 동물성이 이름에 명시된 향료(우유향·버터향 등)는 MILK/MEAT 키워드와 백엔드 vegan_ambiguous로 잡혀요.
const VEGAN_WARN = ['유화제'];

// 식이제한 id → { block, warn }
const RESTRICTION_KEYWORDS: Record<string, { block: string[]; warn: string[] }> = {
  vegan: { block: VEGAN_BLOCK, warn: VEGAN_WARN }, // 동물성 전부
  lacto: { block: [...EGG, ...MEAT, ...SEAFOOD], warn: [] }, // 유제품 OK
  lacto_ovo: { block: [...MEAT, ...SEAFOOD], warn: [] }, // 유제품·계란 OK
  ovo: { block: [...MILK, ...MEAT, ...SEAFOOD], warn: [] }, // 계란 OK
  pesco: { block: [...MEAT], warn: [] }, // 해산물·유제품·계란 OK, 육류만 제한
  gluten_free: { block: WHEAT_GLUTEN, warn: [] },
};

// 식이제한 id → LLM 플래그 (키워드 보완). 육/해산물은 LLM 전용 플래그가 없어 키워드로만 봐요.
const RESTRICTION_FLAG: Record<string, (keyof RiskFlags)[]> = {
  vegan: ['non_vegan'],
  lacto: ['egg'],
  lacto_ovo: [],
  ovo: ['milk'],
  pesco: [],
  gluten_free: ['gluten'],
};

// 프리셋 "첨가물 많아?" 확인 대상
const ADDITIVES = [
  '합성향료', '향료', '감미료', '아스파탐', '수크랄로스', '아세설팜',
  '보존료', '소브산', '소르빈산', '안식향산', '착색료', '색소',
  '산도조절제', '유화제', '증점제', '발색제', '표백제',
];

const labelOf = (id: string): string => {
  const a = ALLERGY_OPTIONS.find((o) => o.id === id);
  if (a) return `${a.label} 알레르기`;
  const r = RESTRICTION_OPTIONS.find((o) => o.id === id);
  if (r) return r.label;
  return id;
};

// 동물성 카테고리(우유·계란·육류·해산물·비건) 매칭에서, '식물성'으로 명시된 성분
// (식물성크림혼합분말·식물성유지 등)은 동물성으로 오인하지 않도록 제외해요.
const PLANT_MARK = '식물성';

// ingredients 배열에서 keyword를 포함하는 항목을 찾아 반환 (근거 표시용 원재료명)
// excludePlant=true면 '식물성' 표기 성분은 건너뛰어요 (동물성 카테고리 전용).
function matchIngredients(ingredients: string[], keywords: string[], excludePlant = false): string[] {
  const found: string[] = [];
  for (const ing of ingredients) {
    if (excludePlant && ing.includes(PLANT_MARK)) continue;
    if (keywords.some((kw) => ing.includes(kw)) && !found.includes(ing)) {
      found.push(ing);
    }
  }
  return found;
}

// 키워드 매칭(결정적·안전) ∪ LLM 플래그(표에 없는 성분 보완)
function combine(
  ingredients: string[],
  keywords: string[],
  llmFlags: string[] = [],
  excludePlant = false
): string[] {
  return [...new Set([...matchIngredients(ingredients, keywords, excludePlant), ...llmFlags])];
}

// 동물성 출처 카테고리 — '식물성' 제외 규칙을 적용할 대상
const ANIMAL_ALLERGY = new Set(['milk', 'egg', 'shellfish', 'mackerel', 'pork', 'beef', 'chicken']);
const ANIMAL_RESTRICTION = new Set(['vegan', 'lacto', 'lacto_ovo', 'ovo', 'pesco']);

export interface Evaluation {
  verdict: Verdict;
  basisLabel: string; // 예: "내 프로필 기준 · 우유 알레르기"
  title: string; // 한 줄 결론
  reasons: string[]; // 근거 원재료 (최대 3개)
}

// 추출 품질이 낮으면(원재료를 거의 못 읽음) 무조건 ⚠️
function lowQuality(ingredients: string[]): boolean {
  return ingredients.filter((i) => i.trim().length > 0).length < 2;
}

const cap3 = (xs: string[]) => xs.slice(0, 3);

// 내 프로필 기준 자동 판단 (PRD 시나리오 D)
export function evaluateProfile(data: ExtractResult, profile: Profile): Evaluation {
  const { ingredients, flags } = data;
  const level = profile.sensitivityLevel;
  const okCount = ingredients.filter((i) => i.trim().length > 0).length;
  // 매우 민감하면 원재료를 더 충분히 읽었을 때만 판단해요.
  if (lowQuality(ingredients) || (level === 'strict' && okCount < 3)) {
    return {
      verdict: 'warning',
      basisLabel: '내 프로필 기준',
      title: '원재료를 충분히\n읽지 못했어요',
      reasons: [],
    };
  }

  const blockHits: { item: string; reason: string }[] = [];
  const warnHits: { item: string; reason: string }[] = [];

  // 알레르기 (전부 ❌급) — 키워드 ∪ LLM 플래그
  for (const id of profile.allergies) {
    const hits = combine(
      ingredients,
      ALLERGY_KEYWORDS[id] ?? [],
      flags[ALLERGY_FLAG[id]!],
      ANIMAL_ALLERGY.has(id)
    );
    hits.forEach((h) => blockHits.push({ item: labelOf(id), reason: h }));
  }
  // 식이제한
  for (const id of profile.restrictions) {
    const kw = RESTRICTION_KEYWORDS[id];
    if (!kw) continue;
    const animal = ANIMAL_RESTRICTION.has(id);
    const llmBlock = (RESTRICTION_FLAG[id] ?? []).flatMap((k) => flags[k]);
    const llmWarn = id === 'vegan' ? flags.vegan_ambiguous : [];
    combine(ingredients, kw.block, llmBlock, animal).forEach((h) =>
      blockHits.push({ item: labelOf(id), reason: h })
    );
    combine(ingredients, kw.warn, llmWarn).forEach((h) =>
      warnHits.push({ item: labelOf(id), reason: h })
    );
  }
  // 직접 입력한 피하고 싶은 성분 (부분일치, ❌급)
  for (const avoid of profile.avoidIngredients) {
    const hits = matchIngredients(ingredients, [avoid]);
    hits.forEach((h) => blockHits.push({ item: `${avoid} 회피`, reason: h }));
  }

  // 민감도 = 매우 민감: 첨가물(향료·감미료·보존료 등)도 ⚠️로 안내해요. (키워드 ∪ LLM)
  if (level === 'strict') {
    combine(ingredients, ADDITIVES, flags.additives).forEach((h) =>
      warnHits.push({ item: '첨가물', reason: h })
    );
  }

  if (blockHits.length > 0) {
    const item = blockHits[0]!.item;
    return {
      verdict: 'danger',
      basisLabel: `내 프로필 기준 · ${item}`,
      title: '피하는 게\n좋겠어요',
      reasons: cap3([...new Set(blockHits.map((h) => h.reason))]),
    };
  }
  // 민감도 = 가볍게: 애매한(출처불명·첨가물) 성분은 넘어가고 명확한 위험만 봐요.
  if (level !== 'light' && warnHits.length > 0) {
    const item = warnHits[0]!.item;
    return {
      verdict: 'warning',
      basisLabel: `내 프로필 기준 · ${item}`,
      title: '확인이\n필요해요',
      reasons: cap3([...new Set(warnHits.map((h) => h.reason))]),
    };
  }
  return {
    verdict: 'ok',
    basisLabel: '내 프로필 기준',
    title: '문제 성분이\n안 보여요',
    reasons: [],
  };
}

export type PresetKey = 'vegan' | 'gluten' | 'additives' | 'milk';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'vegan', label: '비건이야?' },
  { key: 'gluten', label: '글루텐 있어?' },
  { key: 'additives', label: '첨가물 많아?' },
  { key: 'milk', label: '우유 있어?' },
];

// 프리셋 질문 단건 판단
export function evaluatePreset(data: ExtractResult, key: PresetKey): Evaluation {
  const { ingredients, flags } = data;
  if (lowQuality(ingredients)) {
    return {
      verdict: 'warning',
      basisLabel: PRESETS.find((p) => p.key === key)!.label,
      title: '원재료를 충분히\n읽지 못했어요',
      reasons: [],
    };
  }

  switch (key) {
    case 'vegan': {
      const block = combine(ingredients, VEGAN_BLOCK, flags.non_vegan, true);
      const warn = combine(ingredients, VEGAN_WARN, flags.vegan_ambiguous);
      if (block.length > 0) {
        return {
          verdict: 'danger',
          basisLabel: '비건이야?',
          title: '비건으로 보기\n어려워요',
          reasons: cap3(block),
        };
      }
      if (warn.length > 0) {
        return {
          verdict: 'warning',
          basisLabel: '비건이야?',
          title: '출처 확인이\n필요해요',
          reasons: cap3(warn),
        };
      }
      return { verdict: 'ok', basisLabel: '비건이야?', title: '동물성 성분이\n안 보여요', reasons: [] };
    }
    case 'gluten': {
      const hits = combine(ingredients, WHEAT_GLUTEN, flags.gluten);
      // 글루텐은 보수적으로 — 발견 시 ⚠️ (PRD 8.2)
      if (hits.length > 0) {
        return {
          verdict: 'warning',
          basisLabel: '글루텐 있어?',
          title: '글루텐 가능성이\n있어요',
          reasons: cap3(hits),
        };
      }
      return { verdict: 'ok', basisLabel: '글루텐 있어?', title: '글루텐 성분이\n안 보여요', reasons: [] };
    }
    case 'additives': {
      const hits = combine(ingredients, ADDITIVES, flags.additives);
      if (hits.length > 0) {
        return {
          verdict: 'warning',
          basisLabel: '첨가물 많아?',
          title: '확인된 첨가물이\n있어요',
          reasons: cap3(hits),
        };
      }
      return { verdict: 'ok', basisLabel: '첨가물 많아?', title: '눈에 띄는 첨가물이\n안 보여요', reasons: [] };
    }
    case 'milk': {
      const hits = combine(ingredients, MILK, flags.milk, true);
      if (hits.length > 0) {
        return {
          verdict: 'danger',
          basisLabel: '우유 있어?',
          title: '우유 성분이\n있어요',
          reasons: cap3(hits),
        };
      }
      return { verdict: 'ok', basisLabel: '우유 있어?', title: '우유 성분이\n안 보여요', reasons: [] };
    }
  }
}
