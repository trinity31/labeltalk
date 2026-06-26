import csv

# 신청자 목록을 저장할 리스트
applicants = []

# 입금자 목록을 저장할 리스트
payers = []

# 신청자 목록을 읽기
with open("response.csv", mode="r", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # 이름과 전화번호를 튜플로 저장
        applicants.append((row["이름"].strip(), row["전화번호"].strip()))

# 입금자 목록을 읽기
with open("payment.csv", mode="r", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # 이름만 저장
        payers.append(row["거래기록사항"].strip())

# 입금한 사람만 찾아서 출력
paid_applicants = [applicant for applicant in applicants if applicant in payers]

for name in paid_applicants:
    print(f"입금 확인: {name}")

# 새로운 CSV 파일 생성
with open(
    "verified_applicants.csv", mode="w", encoding="utf-8", newline=""
) as verified_file:
    fieldnames = ["이름", "전화번호", "입금 여부"]
    writer = csv.DictWriter(verified_file, fieldnames=fieldnames)

    writer.writeheader()

    for applicant in applicants:
        name, phone = applicant
        # 입금 여부 확인
        paid_status = "입금 완료" if name in payers else "미입금"
        # 새로운 CSV 파일에 쓰기
        writer.writerow({"이름": name, "전화번호": phone, "입금 여부": paid_status})
