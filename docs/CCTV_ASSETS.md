# CCTV 증거 이미지

기본 내장 image_gen 도구로 생성했습니다. 두 장 모두 창작 게임용이며 실제 감시카메라 자료가 아닙니다. 생성본에서 시간 표시, 관리동 표지, 동문 방향 표지와 인물 위치를 확인했습니다. 두 번째 장면은 첫 번째 이미지의 시점과 환경을 유지한 편집본입니다. 해상도 1536×1024, WebP 품질 92로 압축했습니다.

- `public/cctv/c2-20260318-202100.webp`: 첫 캡처
- `public/cctv/c2-20260318-202800.webp`: 다음 캡처

문자 판독문을 기본 화면에서 제거하고 캡처 선택, 확대 모달과 150% 확대를 제공합니다. 이미지 대체 설명은 화면 읽기 도구에서도 같은 관찰 정보를 전달합니다. 기록 번호 2-2와 기존 답안·근거 연결은 유지합니다.

## 2026-09-08 문 연속성 수정

20:28 캡처의 문이 한 장짜리 문으로 바뀌고 손잡이·도어 클로저 위치가 뒤집힌 생성 오류를 수정했습니다. 내장 `image_gen`의 편집 모드로 20:28 원본을 수정 대상으로, 19:58 점검 캡처를 닫힌 양개문 구조의 참조로 사용했습니다. 수정본에서 중앙 이음선, 중앙 손잡이와 왼쪽 상단 도어 클로저를 확인했습니다. 화면 시각 20:28:00, 멀리 동문 쪽으로 걷는 회색 외투 인물, 관리동·동문 표지를 유지했습니다.

최종 파일: `public/cctv/c2-20260318-202800.webp` (1536×1024, WebP 품질 92). 게임에서는 `?v=2`를 붙여 이전 이미지 캐시와 구분합니다. 생성 PNG는 `C:/Users/seong/.codex/generated_images/01a07790-15ec-7f12-8c8f-a0794d97bad2/exec-83d37361-545b-45e7-95e9-083ffc45542f.png`에 보존했습니다. 내용 후처리는 하지 않았으며 형식만 변환했습니다.

최종 수정 프롬프트:

> Use case: precise-object-edit.
> Asset type: one fictional CCTV evidence still in a Korean mystery web game.
> Input images: Image 1 (20:28:00) is the EDIT TARGET and controls the complete scene, person, timestamp, framing and lighting. Image 2 (19:58:00) is ONLY the architectural reference for the closed management double door.
> Primary request: Correct ONLY the closed management door in the LEFT foreground of Image 1 to match the physical double door in Image 2. The current single slab with a handle at the far left is a continuity error. Reproduce the reference door's TWO closed metal leaves, their vertical meeting seam near the middle, lever handles at that center seam, and the door closer on the upper LEFT leaf. Preserve the same outer doorway perspective and dimensions. The left leaf is hinged at its far left edge, matching the reference. Reconstruct the parts hidden by the worker in Image 2 as the matching right leaf, closed flush in the same frame. There must be no single full-width door, no far-left handle, and no reversed hinge geometry.
> Invariants: Everything outside that left door must remain exactly like Image 1: same single unidentified grey-coat person walking AWAY in the distant right corridor at the same position and scale, same coat and hair, same empty foreground, same corridor geometry, wall service hatch, conduit, floor pattern, lights, Korean signs 관리동 and 동문 →, identical fixed high camera viewpoint and monochrome CCTV texture. Do not transfer the worker or the 점검 중 floor stand from Image 2.
> Text: Keep Image 1's complete top black strip exactly: C2   2026-03-18   20:28:00, with REC upper right. No other times or corrected-clock labels.
> Output: one complete 1536x1024 landscape CCTV frame, no collage, annotations, arrows, new objects or additional people. This is a narrowly localized continuity repair, not a redesigned scene.

아래는 최초 생성 당시의 프롬프트입니다.

## 첫 이미지 생성 프롬프트

Use case: photorealistic-natural. Asset type: a fictional CCTV evidence still for a Korean apartment mystery game, landscape 1536x1024. Generate ONE full-frame surveillance capture, no surrounding computer or monitor, no decorative collage, no captions explaining the action. Fixed high corner ceiling camera with a broad view of a modest Korean apartment management-annex entrance corridor at night. Flat fluorescent and dim infrared monochrome grey-green illumination, believable slightly grainy CCTV compression but important evidence readable. The solid door on the LEFT wall has an actual physical Korean sign exactly "관리동" above it. This management door is visibly partly OPEN, its leaf at an angle. A single adult of indeterminate identity in a mid-length GREY COAT is opening it with one hand, standing on the corridor side. Show the figure from behind/above; the face and the small card in their hand cannot be identified or read. On the RIGHT the corridor continues toward the east gate, with a physical overhead direction sign exactly "동문 →". Other than those two room/direction signs, do not add readable notices or numbers in the environment. One person only. No identifiable face, no name badge, no weapon, no crime or violence. At the TOP on a solid thin black CCTV on-screen display strip, large very crisp white monospaced exact text "C2   2026-03-18   20:21:00". This timestamp is a crucial unsynchronized camera display, preserve EXACTLY 20:21:00; do NOT show 20:14 anywhere. Top label must be comfortably readable when the image is scaled to 700 pixels wide. A small "REC" is allowed at upper right. The door-opening action, GREY coat, and both physical direction signs must be visually unambiguous. No arrows pointing at the person, no highlighted clue circles, no extra times or explanatory text. Natural security-camera realism, not cinematic illustration.

## 두 번째 이미지 편집 프롬프트

Use case: precise-object-edit. This is the SAME fixed fictional CCTV camera C2 SEVEN minutes later. Preserve the entire camera viewpoint, lens, corridor geometry, lighting, grey-green monochrome texture, door location on the LEFT, and physical signs "관리동" and "동문 →" EXACTLY as in the reference. Make only these story changes: the management door on the LEFT is now fully CLOSED flush in its frame; move the SAME single adult wearing the same knee-length grey coat to the far RIGHT corridor, below and beyond the "동문 →" sign, walking AWAY from the camera toward the east gate. Show their back and a believable walking stride. Keep their face and card unidentifiable. There must be NO person by the left door anymore, no second person, no new objects, no identity information. Preserve the top black timestamp strip but replace its time with exactly "20:28:00", so the complete large crisp white line reads "C2   2026-03-18   20:28:00". All digits must be correct and readable at 700px image width. Keep "REC" at upper right. Do NOT show 20:21 or 20:14 anywhere. Do not add annotations, clue circles, prose, arrows except the existing physical direction sign. This is a game evidence screenshot and visual continuity is essential. Landscape 1536x1024.
