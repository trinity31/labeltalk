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
import typing
from io import BytesIO
from PIL import Image
import base64
import PIL

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

genai.configure(api_key=os.environ["API_KEY"])

model = genai.GenerativeModel(
    "gemini-2.5-flash",
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        response_schema=LabelAnalysis,
        temperature=0,  # 원재료명을 변형 없이 그대로 전사하도록 결정적으로
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
        if req.is_json:
            payload = req.get_json(silent=True) or {}
            question = payload.get("question", "")
            image_b64 = payload.get("image_base64")

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
                # 메모리/지연/비용 절감 — OCR엔 1024px면 충분해요.
                im.thumbnail((1024, 1024))
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
        2) Then, using your own food knowledge, classify the risk of each ingredient into the flags_* arrays below.
           IMPORTANT: include ingredients even if their names are uncommon or not obviously named — judge by what the ingredient actually is, not just by keyword.
           - flags_non_vegan: ONLY ingredients that are DEFINITELY animal-derived (milk, egg, gelatin, honey, meat/fish, carmine, shellac, etc.).
             Do NOT put minerals/salts here (e.g. 제삼인산칼슘/calcium phosphate, 탄산칼슘, 식염/salt), nor plant proteins (완두단백/pea protein), nor plant-derived lecithin (유채레시틴), nor plain plant ingredients. These are vegan-OK — leave them out.
           - flags_vegan_ambiguous: ingredients whose source could be EITHER animal OR plant and need checking (e.g. 천연향료/natural flavor, 비타민D3, mono-/di-glycerides, enzymes). Put uncertain-source items here, NOT in flags_non_vegan.
           - flags_gluten: wheat/barley/rye/malt or other gluten-containing/likely ingredients
           - flags_milk: milk or dairy-derived ingredients
           - flags_egg: egg-derived ingredients
           - flags_nuts: tree nuts / peanuts
           - flags_soy: soy-derived ingredients
           - flags_shellfish: crustacean/shellfish/seafood ingredients
           - flags_additives: food additives (flavors, sweeteners, preservatives, colors, emulsifiers, thickeners, etc.)
           Each flags_* array should contain the ingredient names (as written in `ingredients`). Use an empty array if none apply.
        3) `answer` is one of "yes"/"no"/"unknown" for the question, `name` is the product name, `reason` is a short explanation. Answer in the same language as the question.

        Answer example:
            {{"answer": "no", "name": "Vermont Curry", "ingredients": ["밀가루", "전지분유", "유청분말", "합성향료", "탄산칼슘"], "reason": "우유 성분이 있어요.", "flags_non_vegan": ["전지분유", "유청분말"], "flags_vegan_ambiguous": ["합성향료"], "flags_gluten": ["밀가루"], "flags_milk": ["전지분유", "유청분말"], "flags_egg": [], "flags_nuts": [], "flags_soy": [], "flags_shellfish": [], "flags_additives": ["합성향료"]}}

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
                return https_fn.Response(
                    response.text, status=200, mimetype="application/json"
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
