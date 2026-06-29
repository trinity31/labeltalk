# 프로필 기준 판정 로직 (프론트 rules.ts에서 백엔드로 이전).
# 키워드/판정 튜닝을 앱 재출시 없이 함수 배포만으로 반영하기 위해 여기서 처리해요.
# 판정은 LLM이 아닌 결정적 키워드 룰 ∪ LLM 플래그(flags_*)로 보수적으로 계산해요.

# --- PRD 8.2 키워드 테이블 ---
MILK = ["우유", "유제품", "분유", "전지분유", "탈지분유", "유청", "버터", "치즈", "크림", "카제인", "카세인", "유당", "락토페린"]
EGG = ["계란", "달걀", "난백", "난황", "전란", "난류"]
NUTS = ["견과", "아몬드", "호두", "캐슈", "피스타치오", "마카다미아", "헤이즐넛", "잣"]
PEANUT = ["땅콩", "낙화생"]
WHEAT_GLUTEN = ["밀", "밀가루", "소맥", "소맥분", "글루텐", "보리", "맥아", "맥아추출물", "호밀"]
BUCKWHEAT = ["메밀"]
SOY = ["대두", "콩", "간장", "된장", "두부", "레시틴"]
SHELLFISH = ["새우", "게", "가재", "랍스터", "조개", "굴", "오징어", "문어", "갑각", "어패", "홍합", "전복"]
MACKEREL = ["고등어"]
PORK = ["돼지", "돈육", "라드", "베이컨", "햄"]
BEEF = ["쇠고기", "소고기", "우육", "사골"]
CHICKEN = ["닭", "계육", "치킨"]
PEACH = ["복숭아"]
TOMATO = ["토마토"]
SULFITES = ["아황산", "메타중아황산", "이산화황"]

# 식이제한용 — 육류/해산물 묶음
MEAT = ["쇠고기", "소고기", "우육", "사골", "돼지고기", "돈육", "닭고기", "계육", "오리고기", "양고기", "육수", "젤라틴", "라드", "베이컨", "햄", "소시지", "벌꿀", "꿀"]
SEAFOOD = ["생선", "어육", "멸치", "가다랑어", "참치", "연어", "고등어", "명태", "대구", "액젓", "젓갈", "새우", "게", "오징어", "문어", "낙지", "조개", "굴", "홍합", "전복", "어묵", "맛살"]

# 비건 위반 — 명확한 동물성(❌급) / 출처 불명(⚠️급)
VEGAN_BLOCK = MILK + EGG + MEAT + SEAFOOD
# 일반 향료·유화제는 시판품에서 거의 식물성(레시틴 등)이라 과판정만 유발해 제외.
# 동물성 출처가 명시된 경우는 MILK/MEAT 키워드와 백엔드 vegan_ambiguous 플래그로 잡혀요.
VEGAN_WARN = []

ADDITIVES = ["합성향료", "향료", "감미료", "아스파탐", "수크랄로스", "아세설팜", "보존료", "소브산", "소르빈산", "안식향산", "착색료", "색소", "산도조절제", "유화제", "증점제", "발색제", "표백제"]

# 알레르기 id → LLM 플래그 카테고리(키워드 표에 없는 성분 보완)
ALLERGY_FLAG = {"milk": "milk", "egg": "egg", "tree_nuts": "nuts", "peanut": "nuts", "wheat": "gluten", "soy": "soy", "shellfish": "shellfish"}

ALLERGY_KEYWORDS = {
    "milk": MILK, "egg": EGG, "tree_nuts": NUTS, "peanut": PEANUT, "wheat": WHEAT_GLUTEN,
    "buckwheat": BUCKWHEAT, "soy": SOY, "shellfish": SHELLFISH, "mackerel": MACKEREL,
    "pork": PORK, "beef": BEEF, "chicken": CHICKEN, "peach": PEACH, "tomato": TOMATO, "sulfites": SULFITES,
}

RESTRICTION_KEYWORDS = {
    "vegan": {"block": VEGAN_BLOCK, "warn": VEGAN_WARN},
    "lacto": {"block": EGG + MEAT + SEAFOOD, "warn": []},
    "lacto_ovo": {"block": MEAT + SEAFOOD, "warn": []},
    "ovo": {"block": MILK + MEAT + SEAFOOD, "warn": []},
    "pesco": {"block": MEAT, "warn": []},
    "gluten_free": {"block": WHEAT_GLUTEN, "warn": []},
}

RESTRICTION_FLAG = {"vegan": ["non_vegan"], "lacto": ["egg"], "lacto_ovo": [], "ovo": ["milk"], "pesco": [], "gluten_free": ["gluten"]}

# 동물성 출처 카테고리 — '식물성' 제외 규칙을 적용할 대상
ANIMAL_ALLERGY = {"milk", "egg", "shellfish", "mackerel", "pork", "beef", "chicken"}
ANIMAL_RESTRICTION = {"vegan", "lacto", "lacto_ovo", "ovo", "pesco"}
PLANT_MARK = "식물성"

ALLERGY_LABEL = {
    "milk": "우유/유제품", "egg": "계란", "tree_nuts": "견과류", "peanut": "땅콩", "wheat": "밀/글루텐",
    "buckwheat": "메밀", "soy": "대두", "shellfish": "갑각류/해산물", "mackerel": "고등어",
    "pork": "돼지고기", "beef": "쇠고기", "chicken": "닭고기", "peach": "복숭아", "tomato": "토마토", "sulfites": "아황산류",
}
RESTRICTION_LABEL = {"vegan": "비건", "lacto": "락토", "lacto_ovo": "락토오보", "ovo": "오보", "pesco": "페스코", "gluten_free": "글루텐 제한"}


def _label_of(rid):
    if rid in ALLERGY_LABEL:
        return f"{ALLERGY_LABEL[rid]} 알레르기"
    if rid in RESTRICTION_LABEL:
        return RESTRICTION_LABEL[rid]
    return rid


def _match_ingredients(ingredients, keywords, exclude_plant=False):
    """원재료 배열에서 keyword를 포함하는 항목을 반환. exclude_plant면 '식물성' 표기 성분은 건너뛰어요."""
    found = []
    for ing in ingredients:
        if exclude_plant and PLANT_MARK in ing:
            continue
        if any(kw in ing for kw in keywords) and ing not in found:
            found.append(ing)
    return found


def _combine(ingredients, keywords, llm_flags=None, exclude_plant=False):
    """키워드 매칭(결정적) ∪ LLM 플래그(표에 없는 성분 보완). 순서 유지 중복 제거."""
    result = []
    for x in _match_ingredients(ingredients, keywords, exclude_plant) + list(llm_flags or []):
        if x not in result:
            result.append(x)
    return result


def _low_quality(ingredients):
    return len([i for i in ingredients if i.strip()]) < 2


def _dedup(xs):
    out = []
    for x in xs:
        if x not in out:
            out.append(x)
    return out


def evaluate_profile(data, profile):
    """추출 결과(data) + 사용자 프로필(profile)로 ✅/⚠️/❌ 판정을 계산해요.

    반환: {verdict, basisLabel, title, reasons}
    """
    ingredients = data.get("ingredients") or []
    flags = {
        "non_vegan": data.get("flags_non_vegan") or [],
        "vegan_ambiguous": data.get("flags_vegan_ambiguous") or [],
        "gluten": data.get("flags_gluten") or [],
        "milk": data.get("flags_milk") or [],
        "egg": data.get("flags_egg") or [],
        "nuts": data.get("flags_nuts") or [],
        "soy": data.get("flags_soy") or [],
        "shellfish": data.get("flags_shellfish") or [],
        "additives": data.get("flags_additives") or [],
    }
    level = profile.get("sensitivityLevel", "normal")
    ok_count = len([i for i in ingredients if i.strip()])

    # 추출 품질이 낮으면(거의 못 읽음) 또는 매우 민감인데 충분히 못 읽었으면 ⚠️
    if _low_quality(ingredients) or (level == "strict" and ok_count < 3):
        return {"verdict": "warning", "basisLabel": "내 프로필 기준", "title": "원재료를 충분히\n읽지 못했어요", "reasons": []}

    block_hits = []  # (item, reason)
    warn_hits = []

    # 알레르기 (전부 ❌급) — 키워드 ∪ LLM 플래그
    for rid in profile.get("allergies", []):
        kws = ALLERGY_KEYWORDS.get(rid, [])
        llm = flags.get(ALLERGY_FLAG.get(rid, ""), [])
        for h in _combine(ingredients, kws, llm, rid in ANIMAL_ALLERGY):
            block_hits.append((_label_of(rid), h))

    # 식이제한
    for rid in profile.get("restrictions", []):
        kw = RESTRICTION_KEYWORDS.get(rid)
        if not kw:
            continue
        animal = rid in ANIMAL_RESTRICTION
        llm_block = []
        for k in RESTRICTION_FLAG.get(rid, []):
            llm_block += flags.get(k, [])
        llm_warn = flags.get("vegan_ambiguous", []) if rid == "vegan" else []
        for h in _combine(ingredients, kw["block"], llm_block, animal):
            block_hits.append((_label_of(rid), h))
        for h in _combine(ingredients, kw["warn"], llm_warn):
            warn_hits.append((_label_of(rid), h))

    # 직접 입력한 피하고 싶은 성분 (부분일치, ❌급)
    for avoid in profile.get("avoidIngredients", []):
        for h in _match_ingredients(ingredients, [avoid]):
            block_hits.append((f"{avoid} 회피", h))

    # 매우 민감: 첨가물도 ⚠️로 안내
    if level == "strict":
        for h in _combine(ingredients, ADDITIVES, flags.get("additives", [])):
            warn_hits.append(("첨가물", h))

    if block_hits:
        item = block_hits[0][0]
        return {"verdict": "danger", "basisLabel": f"내 프로필 기준 · {item}", "title": "피하는 게\n좋겠어요", "reasons": _dedup([r for (_, r) in block_hits])[:3]}

    # 가볍게: 애매한(출처불명·첨가물) 성분은 넘어가고 명확한 위험만
    if level != "light" and warn_hits:
        item = warn_hits[0][0]
        return {"verdict": "warning", "basisLabel": f"내 프로필 기준 · {item}", "title": "확인이\n필요해요", "reasons": _dedup([r for (_, r) in warn_hits])[:3]}

    return {"verdict": "ok", "basisLabel": "내 프로필 기준", "title": "문제 성분이\n안 보여요", "reasons": []}
