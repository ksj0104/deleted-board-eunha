# CCTV 기록 대조

2화는 같은 문 움직임을 담은 점검 영상과 서버 센서 원본을 연결하는 방식으로 조사합니다. 제목은 ‘엇갈린 기록’이며 도입·힌트·점검 문서에 카메라의 오차 값이나 방향을 미리 쓰지 않습니다. 2-1과 2-2를 모두 읽으면 기록 대조를 열 수 있습니다. 시간선을 직접 옮기고 세 사건을 함께 대조한 결과만 확정합니다. 이후 사건 영상에서 원본 시각과 보정 시각을 전환합니다.

- 점검 영상: 화면 19:57 열림 → 19:58 닫힘 → 20:00 다시 열림.
- 센서 원본: 표준시 19:50 열림 → 19:51 닫힘 → 19:53 다시 열림.
- 점검과 사건 구간 사이 카메라 재시작·시각 설정 변경이 없다는 상태 이력으로 같은 보정값을 적용할 근거를 제공합니다.
- 출입 원본에는 20:05·20:14·20:23의 정상 입장도 함께 남습니다. 영상 시각만 보고 유일한 입장 행을 고르는 우회는 제거했습니다.
- 시간선 위치와 대조 완료는 게임 저장의 선택 필드 `calibration`에 보관합니다. 기존 완료 에피소드는 유지하며 다시 대조하기를 제공합니다. 저장 실패는 화면에서 재시도할 수 있고 미확정 상태에서는 사건 영상의 보정 시각이 열리지 않습니다.
- 2화의 시각·순서 추리에는 대조 확인이 필요합니다. 시각은 2-1과 2-2, 순서는 그 두 자료와 출입·정전 근거를 함께 연결합니다. 실제 답안과 인물의 신원에 관한 입증 범위는 유지합니다.

## 생성 이미지

내장 `image_gen` 편집 모드를 사용했습니다. 세 장 모두 기존 C2 복도 구도를 참조하는 창작 감시카메라 이미지입니다. 화면 시각, 문 열림·닫힘과 점검 표지의 연속성을 생성본에서 확인했습니다. 원본 PNG는 생성 도구의 저장 위치에 보존하고, 다음 파일은 1536×1024 WebP 품질 92로 압축했습니다. 이미지 내용은 후처리로 바꾸지 않았습니다.

- `public/cctv/c2-inspection-195700.webp`
- `public/cctv/c2-inspection-195800.webp`
- `public/cctv/c2-inspection-200000.webp`

## 캡처 1 최종 프롬프트

Use case: precise-object-edit. Asset: one fictional CCTV reference capture for a Korean mystery game's record-comparison puzzle. Use the reference image to preserve EXACTLY the high camera view, corridor geometry, left management door and Korean sign 관리동, right corridor sign 동문 →, lens and monochrome grey-green security video realism. Scene is an earlier routine DOOR SENSOR INSPECTION. Remove the grey-coat person entirely. Instead show ONE unidentifiable maintenance worker in a short reflective safety vest, dark work trousers and plain cap, standing to the RIGHT of the left management door, holding the door handle with an outstretched hand. Clearly different clothing from a long coat. Keep the management door visibly OPEN at roughly 45 degrees, like in the reference. Place a small temporary floor stand near the worker with the exact readable Korean words 점검 중. No face identity, names or readable badges. Preserve the large black top CCTV strip and replace ALL top text with exact white monospaced C2   2026-03-18   19:57:00, with REC upper right. No other times or clocks anywhere, no corrected timestamp or offset, no arrows or clue annotations. This is the FIRST door-opening event in an open/closed/open inspection sequence. One full-frame image, landscape 1536x1024, no collage. The source image is an environment reference, not the identity to preserve.

## 캡처 2 최종 프롬프트

Use case: precise-object-edit. SAME fixed CCTV C2 and SAME maintenance inspection ONE minute after the supplied reference. Preserve absolutely the entire camera viewpoint, corridor, both physical signs 관리동 and 동문 →, floor stand 점검 중 in EXACTLY the same place, same one worker's reflective vest, cap and trousers, all surfaces and grey-green monochrome. Change only: the left management door is now fully CLOSED flush in its frame; the worker is standing just to the right of that CLOSED door with his hand lowered, facing the closed door, not blocking our view of it. No new people, no identifiable face. Replace the top large white timestamp with exactly C2   2026-03-18   19:58:00, keep REC. This is the CLOSED moment between two openings. No other timestamps, no offset labels, no comparison collage. One 1536x1024 landscape surveillance capture.

## 캡처 3 최종 프롬프트

Use case: precise-object-edit. SAME fixed CCTV C2 and same maintenance inspection, now the SECOND opening after a brief closed interval. Preserve EXACTLY the camera view, corridor geometry, signs 관리동 and 동문 →, small temporary floor stand 점검 중 in same location, the SAME single worker in reflective vest and cap, monochrome grain and lighting. Open the left management door AGAIN, visibly wider than the reference, approximately 65 degrees into the corridor. Worker now stands one short step back toward the right wall with one hand extending to the door edge. No second person, no identifiable face, no grey coat. Replace the top black strip's large crisp timestamp with exactly C2   2026-03-18   20:00:00, REC upper right. Do not show any other time, clock, offset, colored clue annotation, arrows or collage. One full frame landscape 1536x1024 surveillance capture. Visual continuity with the supplied environment is crucial.
