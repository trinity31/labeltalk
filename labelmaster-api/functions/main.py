# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

# The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
from firebase_functions import firestore_fn, https_fn, options

# The Firebase Admin SDK to access Cloud Firestore.
from firebase_admin import initialize_app, firestore
import google.cloud.firestore

import google.generativeai as genai
import os
import json
import typing
from io import BytesIO
from PIL import Image
import base64
import PIL

from rules import evaluate_profile

from dotenv import load_dotenv
from imghdr import what

load_dotenv()


# Structured Output 스키마 — 응답을 항상 이 구조의 유효한 JSON으로 고정해요.
# flags_*: 키워드 표에 없는 성분까지 LLM이 "의미"로 분류한 위험 성분 목록이에요.
# (프론트의 키워드 룰과 합쳐서 판정 → 표에 없는 성분도 놓치지 않아요)
class LabelAnalysis(typing.TypedDict):
    answer: str  # "yes" | "no" | "unknown"
    name: str  # 제품명
    ingredients: list[str]  # 추출된 원재료 목록 (라벨에 적힌 그대로)
    reason: str  # 판단 근거 설명
    flags_non_vegan: list[str]  # 확실히 동물성인 성분 (❌급)
    flags_vegan_ambiguous: list[str]  # 출처가 불명확해 확인이 필요한 성분 (⚠️급)
    flags_gluten: list[str]  # 글루텐 함유/가능 성분
    flags_milk: list[str]  # 우유/유제품
    flags_egg: list[str]  # 계란
    flags_nuts: list[str]  # 견과류
    flags_soy: list[str]  # 대두
    flags_shellfish: list[str]  # 갑각류/해산물
    flags_additives: list[str]  # 식품첨가물(향료·감미료·보존료·착색료 등)


# 자유 질문 응답 스키마 (askQuestion)
class CustomAnswer(typing.TypedDict):
    status: str  # "ok" | "warning" | "danger"
    title: str  # 한 줄 결론
    reasons: list[str]  # 판단 근거 (원재료/이유, 최대 3개)


genai.configure(api_key=os.environ["API_KEY"])

model = genai.GenerativeModel(
    "gemini-2.5-flash",
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        response_schema=LabelAnalysis,
        temperature=0,  # 원재료명을 변형 없이 그대로 전사하도록 결정적으로
    ),
)

# 자유 질문용 텍스트 전용 모델
qa_model = genai.GenerativeModel(
    "gemini-2.5-flash",
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        response_schema=CustomAnswer,
        temperature=0.2,
    ),
)

app = initialize_app()


@https_fn.on_request(
    memory=options.MemoryOption.MB_512,  # 이미지 처리 OOM 방지
    timeout_sec=120,
    cors=options.CorsOptions(
        # cors_origins=[r"firebase\.com$", r"https://flutter\.com"],
        # cors_methods=["get", "post"],
        cors_origins=["*"],  # 모든 출처 허용
        cors_methods=["GET", "POST", "PUT", "DELETE"],  # 모든 메소드 허용
    )
)
# def analyzeImage(req: https_fn.Request) -> https_fn.Response:
#     prompt = """
#             List 5 popular vegan recipes.
#             Using this JSON schema:
#                 Recipe = {"recipe_name": str, "ingredients": list[str]}
#             Return a `list[Recipe]`
#             """
#     response = model.generate_content(prompt)
#     return https_fn.Response(response.text)


# Instruction
# 당신은 모든 언어로  표기된 제품의 성분표를 보고 질문에 대답할 수 있습니다. 당신은 식품 및 의약품에 대한 전문가입니다.  의심스러운 성분이 있다면 약간의 부가 설명과 함께 출처 링크를 표시해 주세요. 응답은 json 으로 해주세요.  response 는 "yes", "no", "unknown" 중 하나이며 "reason" 에는 성분에 대한 약간의 부가 설명과 함께 참고 링크가 있다면 함께 써주세요.  질문한 언어와 동일한 언어로 대답해 주세요.

# Question
# 이 식품은 비건인가요?

# Example response:
# response: {{'answer': 'yes', 'reason': 'This product includes Sodium Fluor.'}}


# prompt = f"""
# Instruction:
# You can extract the text in the image, and recognize what ingredients are included. You are an expert in food and medicine. If you have any doubts about the ingredients, please indicate the source link with a little additional explanation. The response should be in json format. The response is one of "yes", "no", "unknown", and if there is a reference link with a little additional explanation about the ingredient, please write it together. Please answer in the same language as the question.

# Question:
# Is Sodium Fluor included in this product?

# Answer example:

# {{"answer": "yes",
# "reason": "This product includes Sodium Fluor"
# }}
# """


def analyzeImage(req: https_fn.Request) -> https_fn.Response:
    try:
        temp_image_path = f"/tmp/image.jpg"

        # 입력은 두 가지 방식을 지원해요.
        # 1) JSON 본문: { "image_base64": "...", "question": "..." } (토스 미니앱 RN 연동용)
        # 2) multipart/form-data: file + question (기존 방식)
        profile = None  # 프로필 기준 판정용 (없으면 추출만 반환)
        if req.is_json:
            payload = req.get_json(silent=True) or {}
            question = payload.get("question", "")
            image_b64 = payload.get("image_base64")
            profile = payload.get("profile")

            if not image_b64:
                return https_fn.Response("No image_base64 provided", status=400)

            # data URI 접두사(data:image/jpeg;base64,)가 있으면 제거
            if image_b64.strip().startswith("data:") and "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            try:
                image_bytes = base64.b64decode(image_b64)
            except Exception:
                return https_fn.Response("Invalid base64 image", status=400)

            with open(temp_image_path, "wb") as f:
                f.write(image_bytes)
        else:
            if not req.files or "file" not in req.files:
                return https_fn.Response("No data provided", status=400)

            # 이미지 데이터를 받아 처리
            image_file = req.files["file"]
            question = req.form.get("question", "")

            # Ensure the MIME type is supported
            if not image_file.content_type.startswith("image/"):
                return https_fn.Response("Unsupported file type", status=400)

            image_file.save(temp_image_path)

        print(f"Question: {question}")

        # 이미지를 JPEG 바이트로 정규화해 인라인으로 전달해요.
        # (Files API 업로드 왕복을 없애 SSL 불안정/지연을 줄여요.)
        try:
            with Image.open(temp_image_path) as im:
                if im.mode != "RGB":
                    im = im.convert("RGB")
                # 원재료표는 깨알 같은 작은 글씨라 해상도가 OCR 정확도를 좌우해요.
                # 1024px에선 글자가 뭉개져 오독/누락이 생겨 2048px로 올렸어요.
                # (Gemini 2.5는 큰 이미지를 타일로 처리. 메모리 512MB 내에서 안전)
                im.thumbnail((2048, 2048))
                buf = BytesIO()
                im.save(buf, format="JPEG", quality=90)
                image_part = {"mime_type": "image/jpeg", "data": buf.getvalue()}
        except Exception:
            with open(temp_image_path, "rb") as f:
                image_part = {"mime_type": "image/jpeg", "data": f.read()}

        # 프롬프트 설정
        instruction = f"""
        Instruction:
        1) Transcribe the ingredient list (원재료명) from the label into `ingredients`, copying each ingredient name VERBATIM — character-for-character, in the original Korean exactly as printed.
           - Do NOT replace a specific ingredient with its functional category. e.g. keep "유채레시틴" as "유채레시틴" (do NOT write "유화제"); keep "비타민D3" as "비타민D3" (do NOT write "비타민D"); keep "제삼인산칼슘" as "제삼인산칼슘".
           - Do NOT translate, summarize, normalize, paraphrase, abbreviate, or "correct" the names. Read the small print carefully and copy it exactly.
        2) CRITICAL — Allergen statements. Korean labels print allergen info SEPARATELY from the 원재료명. There are TWO DIFFERENT kinds and you MUST handle them differently:
           (a) CONTAINS — "함유": e.g. "대두, 밀 함유", "알레르기 유발물질: 우유 함유", "○○ 함유". These allergens ARE in the product.
               → For EACH, add "○○(함유)" to `ingredients` (e.g. "우유(함유)", "대두(함유)"), AND put it in the matching flags_* array: 우유→flags_milk, 대두→flags_soy, 계란/난류→flags_egg, 밀→flags_gluten, 땅콩·견과류(호두·잣·아몬드 등)→flags_nuts, 새우·게·조개·갑각류→flags_shellfish.
               → Do this EVEN IF not obviously named in the 원재료명 (a creamer/culture medium may contain milk without "우유" appearing).
           (b) CROSS-CONTAMINATION — 같은 시설/혼입 가능 (NOT in the product): e.g. "○○를 사용한 제품과 같은 제조시설에서 제조", "○○ 혼입 가능", "○○를 사용한 시설에서 생산". These allergens are NOT ingredients of this product.
               → Add EACH as "○○(교차오염)" to `ingredients`, and DO NOT put them into ANY flags_* array.
           매우 중요: "같은 제조시설"·"혼입 가능"은 절대 "함유"로 취급하지 마세요(완전히 다른 의미예요). 두 문장이 모두 있으면 각각 "(함유)"와 "(교차오염)"으로 구분해 정확히 표기하세요. 함유가 아닌 성분을 함유로 잘못 표기하는 건 심각한 오류예요.
        3) Then, using your own food knowledge, classify the risk of each ingredient into the flags_* arrays below.
           IMPORTANT: include ingredients even if their names are uncommon or not obviously named — judge by what the ingredient actually is, not just by keyword.
           - flags_non_vegan: ONLY ingredients that are DEFINITELY animal-derived (milk, egg, gelatin, honey, meat/fish, carmine, shellac, etc.).
             Do NOT put minerals/salts here (e.g. 제삼인산칼슘/calcium phosphate, 탄산칼슘, 식염/salt), nor plant proteins (완두단백/pea protein), nor plant-derived lecithin (유채레시틴), nor plain plant ingredients. These are vegan-OK — leave them out.
             Do NOT put flavorings here either — "○○향" 향미 성분(치킨향분말·소고기향·우유향 등), 향료, 착향료는 향미 첨가물로 거의 합성/식물성이라 동물성이 아니에요. 실제 동물성은 향이 아니라 직접 성분명(닭고기·우유·유청 등)으로 판단하세요.
           - flags_vegan_ambiguous: ingredients whose source could genuinely be EITHER animal OR plant and need checking (e.g. 비타민D3, mono-/di-glycerides(모노·디글리세리드), enzymes(효소)). Put uncertain-source items here, NOT in flags_non_vegan.
             IMPORTANT: Do NOT flag common staples that are practically vegan — 설탕/sugar, 소금/salt, 밀가루/flour, 전분/starch, 식물성 기름/plant oils, 식초/vinegar, 고추장, 된장, 간장, 고춧가루, 쌀/현미 등은 비건으로 간주하고 비우세요.
             ALSO treat ALL flavorings as practically vegan: 향료·합성향료·천연향료·착향료·"향료 N종"은 물론, "○○향"으로 된 향미 성분(치킨향분말·소고기향·우유향·버터향 등 동물성을 연상시키는 것 포함)도 시판품에선 거의 합성/식물성이라 flags_non_vegan·flags_vegan_ambiguous 어디에도 넣지 마세요. 실제 동물성은 향이 아니라 직접 성분명(우유·유청·닭고기 등)이나 "함유" 표시로만 판단해요(그건 키워드로 따로 잡혀요).
             Judge ingredients as commonly produced; do NOT flag something merely because of rare processing methods (e.g. bone-char-refined sugar) or theoretical trace contamination. Only flag when the ingredient itself has a real uncertain animal-vs-plant origin.
           - flags_gluten: wheat/barley/rye/malt or other gluten-containing/likely ingredients
           - flags_milk: milk or dairy-derived ingredients
           - flags_egg: egg-derived ingredients
           - flags_nuts: tree nuts / peanuts
           - flags_soy: soy-derived ingredients
           - flags_shellfish: crustacean/shellfish/seafood ingredients
           - flags_additives: food additives (flavors, sweeteners, preservatives, colors, emulsifiers, thickeners, etc.)
           Each flags_* array should contain the ingredient names (as written in `ingredients`). Use an empty array if none apply.
        4) `answer` is one of "yes"/"no"/"unknown" for the question, `name` is the product name, `reason` is a short explanation. Answer in the same language as the question.

        Answer example:
            {{"answer": "no", "name": "Vermont Curry", "ingredients": ["밀가루", "전지분유", "유청분말", "합성향료", "탄산칼슘"], "reason": "우유 성분이 있어요.", "flags_non_vegan": ["전지분유", "유청분말"], "flags_vegan_ambiguous": [], "flags_gluten": ["밀가루"], "flags_milk": ["전지분유", "유청분말"], "flags_egg": [], "flags_nuts": [], "flags_soy": [], "flags_shellfish": [], "flags_additives": ["합성향료"]}}

        Allergen-declaration example — label lists 식물성크림혼합분말 (no "우유" in the list) but a separate box says "복숭아, 우유, 대두 함유":
            {{"answer": "no", "name": "데일리 콤부차 피치", "ingredients": ["콤부차분말", "복숭아과즙분말", "식물성크림혼합분말", "우유(함유)", "대두(함유)", "복숭아(함유)"], "reason": "우유·대두·복숭아 알레르기 표시가 있어요.", "flags_non_vegan": [], "flags_vegan_ambiguous": ["식물성크림혼합분말"], "flags_gluten": [], "flags_milk": ["우유(함유)"], "flags_egg": [], "flags_nuts": [], "flags_soy": ["대두(함유)"], "flags_shellfish": [], "flags_additives": []}}

        Question:
        Is this product vegan?
        """

        prompt = f"""
        Instruction:
        {instruction}

        Question:
        {question}
        """

        # 일시적 SSL/네트워크 오류만 최대 3회 재시도해요.
        # 쿼터 초과(429)·잘못된 요청(400)은 재시도해도 소용없고 쿼터만 더 쓰므로 즉시 중단해요.
        last_err = None
        for attempt in range(3):
            try:
                response = model.generate_content(contents=[image_part, prompt])
                result_text = response.text
                # 프로필이 오면 추출 결과에 프로필 기준 판정(verdict)을 더해 함께 반환해요.
                # (structured output이라 항상 유효한 JSON. 만약 파싱 실패하면 추출만 반환)
                if profile:
                    try:
                        parsed = json.loads(result_text)
                        parsed["verdict"] = evaluate_profile(parsed, profile)
                        result_text = json.dumps(parsed, ensure_ascii=False)
                    except Exception as ex:
                        print(f"verdict 계산 건너뜀: {ex}")
                return https_fn.Response(
                    result_text, status=200, mimetype="application/json"
                )
            except Exception as e:
                last_err = e
                msg = str(e)
                print(f"generate_content attempt {attempt + 1}/3 failed: {e}")
                if "429" in msg or "quota" in msg.lower() or "400" in msg:
                    break

        # 쿼터 초과는 429로 명확히 알려서 프론트가 안내 메시지를 구분할 수 있게 해요.
        if last_err is not None and (
            "429" in str(last_err) or "quota" in str(last_err).lower()
        ):
            return https_fn.Response(
                "Rate limited: Gemini API quota exceeded.", status=429
            )
        raise last_err

    except Exception as e:
        print(f"Error analyzing image: {e}")
        return https_fn.Response("Internal Server Error", status=500)


@https_fn.on_request(
    memory=options.MemoryOption.MB_256,
    timeout_sec=60,
    cors=options.CorsOptions(
        cors_origins=["*"],
        cors_methods=["GET", "POST", "PUT", "DELETE"],
    ),
)
def askQuestion(req: https_fn.Request) -> https_fn.Response:
    """이미 추출된 원재료에 대해 사용자의 자유 질문에 답해요 (텍스트 전용, 사진 재분석 없음)."""
    try:
        payload = req.get_json(silent=True) or {}
        ingredients = payload.get("ingredients") or []
        question = (payload.get("question") or "").strip()
        product = (payload.get("product_name") or "").strip()
        sensitivity = (payload.get("sensitivity") or "normal").strip()

        if not question:
            return https_fn.Response("No question provided", status=400)
        if not ingredients:
            return https_fn.Response("No ingredients provided", status=400)

        if sensitivity == "light":
            sensitivity_rule = "사용자 민감도는 '가볍게'예요. 명확한 근거가 있을 때만 위험으로 판단하고, 미량 혼입·가공방식 같은 이론적 가능성은 무시하세요. 애매하면 관대하게 ok 쪽으로."
        elif sensitivity == "strict":
            sensitivity_rule = "사용자 민감도는 '매우 민감'이에요. 조금이라도 의심되면 보수적으로 warning 이상으로 판단하세요."
        else:
            sensitivity_rule = "사용자 민감도는 '보통'이에요. 균형 있게 판단하세요."

        ingredient_text = ", ".join(str(i) for i in ingredients)
        prompt = f"""
        당신은 식품 라벨 도우미예요. 아래 '원재료'만을 근거로 사용자 질문에 답하세요.

        제품명: {product or "(미상)"}
        원재료: {ingredient_text}
        질문: {question}

        규칙:
        - status 는 "ok"(괜찮아 보임) / "warning"(확인 필요·애매) / "danger"(피하는 게 좋음) 중 하나예요.
        - {sensitivity_rule}
        - 알레르기·건강과 직결된 명확한 위험은 민감도와 무관하게 보수적으로 알려주세요. 단, 흔한 식물성 기본 재료(설탕·소금·밀가루·전분·식물성 기름·식초·고추장·된장·간장·고춧가루·쌀 등)는 비건으로 간주하고, "미량 혼입 가능"이나 "가공 방식" 같은 이론적 가능성만으로 위험하다고 하지 마세요.
        - title 은 한 줄 결론이에요. 짧고 자연스러운 한국어로. "안전합니다", "먹어도 됩니다" 같은 단정·보장 표현은 쓰지 마세요.
        - reasons 는 판단 근거가 된 원재료나 이유를 최대 3개까지 넣어요. 없으면 빈 배열.
        - 반드시 한국어로 답하세요.
        """

        last_err = None
        for attempt in range(3):
            try:
                response = qa_model.generate_content(prompt)
                return https_fn.Response(
                    response.text, status=200, mimetype="application/json"
                )
            except Exception as e:
                last_err = e
                msg = str(e)
                print(f"askQuestion attempt {attempt + 1}/3 failed: {e}")
                if "429" in msg or "quota" in msg.lower() or "400" in msg:
                    break

        if last_err is not None and (
            "429" in str(last_err) or "quota" in str(last_err).lower()
        ):
            return https_fn.Response("Rate limited: quota exceeded.", status=429)
        raise last_err

    except Exception as e:
        print(f"Error answering question: {e}")
        return https_fn.Response("Internal Server Error", status=500)


@https_fn.on_request()
def addmessage(req: https_fn.Request) -> https_fn.Response:
    """Take the text parameter passed to this HTTP endpoint and insert it into
    a new document in the messages collection."""
    # Grab the text parameter.
    original = req.args.get("text")
    if original is None:
        return https_fn.Response("No text parameter provided", status=400)

    try:
        firestore_client: google.cloud.firestore.Client = firestore.client()
    except Exception as e:
        # 예외 로깅
        print(f"Error adding document: {e}")
        return https_fn.Response("Error adding document", status=500)

    # Push the new message into Cloud Firestore using the Firebase Admin SDK.
    _, doc_ref = firestore_client.collection("messages").add({"original": original})

    # Send back a message that we've successfully written the message
    return https_fn.Response(f"Message with ID {doc_ref.id} added.")


@firestore_fn.on_document_created(document="messages/{pushId}")
def makeuppercase(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    """Listens for new documents to be added to /messages. If the document has
    an "original" field, creates an "uppercase" field containg the contents of
    "original" in upper case."""

    # Get the value of "original" if it exists.
    if event.data is None:
        return
    try:
        original = event.data.get("original")
    except KeyError:
        # No "original" field, so do nothing.
        return

    # Set the "uppercase" field.
    print(f"Uppercasing {event.params['pushId']}: {original}")
    upper = original.upper()
    event.data.reference.update({"uppercase": upper})
