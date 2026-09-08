# 3화 문서 이미지와 실제 파쇄 조각

2026-09-08. 내장 `image_gen`으로 세금계산서, 업체 회신, 은행 이체 확인서, 결산 수정 쪽지의 원본 이미지 네 장을 생성했습니다. CLI/API 대체 경로는 사용하지 않았습니다. 등장 업체·은행·문서·거래는 게임 속 창작입니다.

## 저장 파일과 사용 위치

| 자료                        | 프로젝트 파일                                                      | 사용 위치                            |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| 한결설비 세금계산서         | `public/documents/e318-tax-invoice.webp`                           | 3-2 첫 페이지, 지급 전표 조사대      |
| 한결설비 확인 회신 공문     | `public/documents/e318-supplier-reply.webp`                        | 3-2 두 번째 페이지, 지급 전표 조사대 |
| 공동관리비 은행 이체 확인서 | `public/documents/e318-transfer-confirmation.webp`                 | 3-3, 지급 전표 조사대                |
| 결산 수정 쪽지 완성본       | `public/documents/settlement-memo.webp`                            | 3-5 복원 성공 후 확대 열람           |
| 원본에서 잘라낸 6조각       | `public/documents/settlement-{cedar,reed,ash,elm,pine,birch}.webp` | 3-5 복원 작업대                      |

앞의 세 공문은 1024×1536이며 WebP 품질 94로 저장했습니다. 쪽지 원본은 1536×1024이며 손실 없는 WebP로 저장했습니다. 사용자가 요청한 크롭은 sharp로 수행했습니다. 원본을 왼쪽부터 폭 256픽셀씩 잘라 256×1024 조각 여섯 장을 별도 파일로 저장했습니다. 글자를 다시 그리거나 조각마다 독립 이미지를 생성하지 않았습니다.

조각 식별자와 정답 순서, 첫 배치, 저장 버전은 기존 그대로입니다. 초기 화면은 `elm, birch, cedar, pine, reed, ash` 순서로 섞습니다. 이미 복원한 저장은 완료 상태로 열리며 재플레이가 가능합니다. 복원 전에는 완성본 이미지와 전문이 표시되지 않습니다. 여섯 조각을 정답 순서로 연결한 결과와 원본의 모든 RGB 픽셀이 일치합니다. 크롭 좌표·크기·원본 해시는 [EPISODE3_ASSETS.json](EPISODE3_ASSETS.json)에 보관합니다.

## 내용 검수와 열람

생성 결과를 직접 확인하여 다음 정보를 원문과 대조했습니다.

- 세금계산서: E-318, 한결설비, 세금 포함 1,800,000원, 추가 청구 없음, 계좌 4402, 03.15 입금, 03.17 14:12 원본 확인.
- 업체 회신: 최종 공사비·추가 청구 없음, 4402 입금 완료, 8291은 당사 소유가 아니라는 회신, 같은 작업번호와 시각.
- 은행 확인서: TX318-A / 4402 / 1,800,000원, TX318-B / 8291 / 3,000,000원, M-01 승인 단말, 두 수취인명 가림. 가려진 이름을 이미지에 노출하지 않습니다.
- 쪽지: 03.17 16:50 오유진→조민석, 한결 180만·다온 300만 분리, 공개본의 합산, 수정 요청, 조민석의 거부 및 승인 회신. 파쇄 행위자를 추가로 특정하지 않습니다.

문서 이미지를 누르면 별도 모달에서 전체 또는 150%로 확대합니다. 세금계산서와 업체 회신은 페이지 전환으로 비교합니다. 확대 창을 닫거나 취소해도 아래 원문과 조사대가 유지됩니다. 검색·접근성을 위한 기존 텍스트 원문과 조각별 읽기 설명은 남겨둡니다.

## 생성 프롬프트

### invoice

생성 원본 파일: `exec-9ae480b9-8e0e-42bc-8d71-83cfee65ba18.png`

```text
Use case: productivity-visual. Asset type: a readable full-page Korean tax-invoice archive image inside a fictional mystery game. Generate ONE flat scanned paper document, portrait 2:3, high resolution, no perspective, no desk or hands, paper fills frame, generous 6% margins. An understated red ruled Korean invoice form, ivory paper and dark sharp Korean typesetting, realistic minor toner/paper grain, large readable type. This is a fictional business document, not a tutorial or game UI. Heading "세금계산서". Subheading "보관용 사본". Supplier "한결설비", recipient "은하아파트 관리사무소". Table exact content: "작업번호" "E-318"; "품목" "승강기 긴급 보수"; "공급 내용" "부품 · 인건비"; "최종 합계금액" "1,800,000원"; "부가세" "포함"; "추가 청구" "없음"; "수금 계좌 끝자리" "4402"; "입금 확인일" "2026.03.15". Bottom archive line "원본 확인: 2026.03.17 14:12". Red square supplier seal reading "한결설비". Small footer "은하아파트 보관 기록". Design the form with coherent visible grid lines and official typography. These exact numbers and Korean strings are crucial. Do not invent separate tax amounts, extra fees, business registration numbers, full account numbers, real bank logos, people, detective notes, red highlighting of clues, or conclusions.
```

### reply

생성 원본 파일: `exec-3d10a400-0f40-4351-9f3a-f9f3a22e6938.png`

```text
Use case: productivity-visual. Asset type: a Korean supplier's formal written reply for a fictional mystery game. ONE portrait 2:3 flat scanned official correspondence page, highest readable Korean typesetting, off-white paper with subtle crease and neat dark charcoal type, muted blue letterhead, no desk or decorative objects. Header "한결설비". Document title "공사비 및 수금 계좌 확인 회신". Metadata lines "수신: 은하아파트 관리사무소", "회신 일시: 2026.03.17 14:12", "관련 작업: E-318 승강기 긴급 보수". Three numbered paragraphs, exact text: "1. E-318의 부품·인건비·부가세를 포함한 최종 공사비는 1,800,000원입니다. 해당 작업의 추가 청구는 없습니다." "2. 당사 수금 계좌 끝 네 자리는 4402이며, 3월 15일에 전액 입금되었습니다." "3. 8291 계좌는 당사 소유가 아닙니다." A lower attachment line "붙임: E-318 세금계산서 보관용 사본 1부". Closing company name "한결설비" with realistic red square company seal. A thin blue header rule and ample official-document whitespace. Large body type, neatly wrapped short lines. Do not add new narrative facts, legal conclusion, answer highlights, full account numbers, actual real-world brand logos or extra fees.
```

### bank

생성 원본 파일: `exec-5fda81e8-b2df-479e-a798-90e740a456f4.png`

```text
Use case: productivity-visual. Asset type: a formal bank transfer confirmation archive for a fictional mystery game. ONE flat portrait 2:3 document image, readable Korean, subtle pale blue bank security pattern and precise dark blue/black type on white. Fictional bank masthead "은하은행", document heading "공동관리비 이체 확인서". The document must look like a crisp bank-issued scan, no perspective, no hands, no browser interface. Metadata "거래일: 2026.03.15", "보관 시각: 15:42", "출금 계정: 은하아파트 공동관리비", "관련 작업번호: E-318". Central large clean table exact columns "이체 번호 | 수취 계좌 끝자리 | 이체 금액 | 처리 결과"; row one "TX318-A | 4402 | 1,800,000원 | 완료"; row two "TX318-B | 8291 | 3,000,000원 | 완료". Below table two dark black redaction bars for "수취인명" corresponding to A and B; the names themselves must NOT be readable. Text "승인 단말: M-01 (관리소장 전용)" and "동일 은행의 두 수취 계좌 끝자리는 서로 중복되지 않습니다." Small note "수취인 명칭을 가린 보관 사본입니다." Bottom bank-issued blue circular confirmation stamp and "이체 결과 원본 대조필". Keep exact TX IDs, money, four-digit account endings. Do not invent a total, recipient company identities, signatures of a person, full account numbers, QR codes or investigative conclusions. Paper margins and whitespace, sufficiently large numerals to read when zoomed.
```

### shred

생성 원본 파일: `exec-8d69068a-1ffa-4e57-8c54-0c265cbcd3da.png`

```text
Use case: productivity-visual. Asset type: ORIGINAL UN-CUT memo image for a document reconstruction puzzle in a Korean fictional mystery game. Produce ONE intact flat scanned memo, landscape 3:2, high resolution, cream office paper fills all frame, no visible cuts or shredded pieces yet. We will crop this exact image into six VERTICAL strips ourselves. Lay out handwritten Korean text continuously across most of the page width so words, numbers, long hand-drawn table rules, and signature strokes cross future strip boundaries. A printed narrow header and slightly slanted but VERY LEGIBLE dark blue ballpoint body, black printed money table, lower dark ink handwritten reply with an underline. Add a faint diagonal fold and a small coffee ring near bottom right as visual matching clues, without obscuring text. No piece labels, numbers showing order, puzzle UI, desk or objects. Exact text: title "결산 수정 검토 쪽지"; metadata "2026.03.17 16:50   오유진 → 조민석"; subject "작업번호 E-318 / 공개 결산서 수정 요청". Body "소장님, 제가 입력한 원본에는 아래 두 건이 분리되어 있었습니다." Two-row wide table: "한결설비 / 공사비 최종 / 1,800,000원" and "다온기획 / 별도 지급액 / 3,000,000원". Next "공개본에서는 두 건 모두 한결설비로 합산되어 있어요." "결산서를 다시 올려도 될까요?" Reply block "회신 / 조민석" then exact "수정하지 마세요. 두 건 모두 제가 승인한 결산입니다." and "원본 파일은 제가 정리하겠습니다." Avoid any other numeric amounts, added admissions, culprit labels or stamps identifying who shredded this paper. No text clipping; exact readable Korean. Keep margins narrow enough that every vertical sixth contains fragments of the text, not an empty margin.
```
