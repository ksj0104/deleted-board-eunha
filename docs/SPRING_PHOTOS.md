# 목련과 파전 게시판 사진

2026-09-09. 내장 `image_gen`으로 목련 관련 사진 네 장과 파전 후기 사진 한 장을 생성했습니다. PNG 원본은 생성 폴더에 보존하고, 아래 WebP 파일은 sharp로 품질 90으로 변환했습니다. CLI/API 대체 경로는 사용하지 않았습니다.

## 글과 이미지 연결

| 이미지 | 사용 글과 장면 |
| --- | --- |
| `public/community/flowers.webp` (기존) | 3-7 · 처음 꽃이 핀 목련 사진 |
| `public/community/magnolia-phone.webp` | 4-13 · 주민 사진을 배경으로 설정한 휴대전화 |
| `public/community/magnolia-walkway.webp` | 3-16 · 낮에 직접 찍은 아파트 산책로 |
| `public/community/magnolia-last-spring.webp` | 1-84 · 지난봄에 만개한 목련나무 |
| `public/community/magnolia-spring-wallpaper.webp` | 7-8 · 새로 찍은 꽃 두 송이와 초록 배경 |
| `public/community/pancakes-followup.webp` | 2-11 · 다시 부친 파전 후기 / 6-11 · 글에서 명시한 예전 파전 사진 |

핵심 목련 글 세 편(3-7, 4-13, 7-8)에 서로 다른 장면을 연결했고, 같은 사진을 쓰던 확장 기록 두 편(1-84, 3-16)도 각기 다른 사진으로 바꿨습니다. 휴대전화 화면 안의 배경만 주민이 공유한 원래 꽃 사진을 참조합니다. 7-8과 3-16의 제목·본문·댓글은 새 사진의 촬영 상황에 맞췄습니다.

첫 파전 글 1-7은 기존 접시 사진을 유지합니다. 2-11은 얇은 반죽과 늘어난 파가 보이는 팬 사진을 새로 첨부하고 ‘사진 없음’ 문구를 고쳤습니다. 6-11은 감자전 이야기를 하며 예전 파전 사진을 첨부한다고 명시한 글이므로 같은 후기 사진을 사용합니다. 글 수와 사건 단서는 변경하지 않았습니다.

## 생성 프롬프트

### magnolia-phone

프로젝트 파일: `public/community/magnolia-phone.webp`  
생성 원본: `exec-9889ee0c-677d-4e26-8de1-ba9d72bd625c.png`

참조 이미지: `public/community/flowers.webp` (휴대전화 화면의 기존 배경).

```text
Use case: photorealistic-natural. Generate a candid resident photo for a Korean apartment community post about setting a neighbor's magnolia picture as a phone wallpaper. Square photograph. An ordinary unbranded smartphone lying on a pale bedside table in soft morning window light beside a plain alarm clock and a folded cardigan. The entire smartphone screen displays the supplied reference photo of white magnolia branches against apartment buildings as wallpaper. Reference image role: content on phone screen only, preserve its recognizable flowers and blue sky; create a completely new photographed scene around the phone. Screen is awake with wallpaper only, no readable time, notifications or personal data. Slight everyday framing and real glass reflections, sharp phone wallpaper, no studio advertisement, no people, no collage, no text overlay, no brand logos.
```

### magnolia-walkway

프로젝트 파일: `public/community/magnolia-walkway.webp`  
생성 원본: `exec-e43efb9c-8abc-43be-a479-a94718a01479.png`

```text
Use case: photorealistic-natural. Generate one square everyday smartphone photograph from a pedestrian's viewpoint on a Korean apartment courtyard walking path at lunchtime in early spring. A small magnolia tree on the LEFT edge has mostly furry closed buds and a few white blooms beginning to open. The walkway curves from bottom right into the middle distance with a bench and soft-focus ordinary apartment facades far behind. Bright overcast midday light. It must be a WIDE environmental walking-path shot, not a close-up flower on a blue sky. Calm candid resident photography, natural imperfections, muted spring colors, no people, no text, no signage, no collage. Magnolia only, not cherry blossoms.
```

### magnolia-last-spring

프로젝트 파일: `public/community/magnolia-last-spring.webp`  
생성 원본: `exec-a3846800-1ade-4360-b3a9-84828ebbb6bd.png`

```text
Use case: photorealistic-natural. One square personal archive snapshot from LAST spring in a Korean apartment courtyard. A mature white magnolia tree in FULL BLOOM fills the view, photographed from across a low hedge in warm late-afternoon sunlight. Broad ivory cup-shaped magnolia flowers on bare branches, some naturally fallen white petals scattered on the ground. Low stone garden border at foreground and softly blurred residential buildings in distance. Wider full-tree framing, warm golden light, visibly different from a blue-sky flower close-up and a budding tree by a path. Believable phone photo, not stock advertising. No date stamp, text, people, collage, or cherry blossoms.
```

### magnolia-spring-wallpaper

프로젝트 파일: `public/community/magnolia-spring-wallpaper.webp`  
생성 원본: `exec-2849c86c-574a-4ce0-8bf2-73522f85fcff.png`

```text
Use case: photorealistic-natural. One square high-resolution resident photograph of a white magnolia branch for sharing as a phone wallpaper. Intimate side-on CLOSE-UP of two fully opened ivory magnolia flowers on a diagonally rising dark branch, one large flower in the bottom left, smaller flower at top right, against softly blurred sage-green hedges and warm gray path. Soft diffuse early morning light with a few raindrops on petals. Uncluttered composition and shallow depth of field, no apartment buildings or blue sky in this shot. Real magnolia thick broad petals, not cherry blossoms. Natural phone-camera photography, no collage, no people, no text or logos.
```

### pancakes-followup

프로젝트 파일: `public/community/pancakes-followup.webp`  
생성 원본: `exec-35ceacfa-8c13-42e9-9989-2f5e6cff48ed.png`

```text
Use case: photorealistic-natural. One square casual Korean home-cooking smartphone photograph for a resident's follow-up post: after advice they used much LESS batter and MORE scallions, making a noticeably thinner, crispier pajeon. Close overhead diagonal view of a dark nonstick frying pan on an ordinary home stovetop, containing one irregular thin Korean scallion pancake with abundant long green scallions, golden lacy crispy edges and a small wedge removed to reveal a thin middle. Wooden spatula resting beside the pan, warm kitchen evening light, modest everyday realism and slight oil sheen. No seafood, no hands, no people. It must look distinctly different from a thick round pancake on a white dining plate with dipping sauce. No text, logos, collage, magazine styling or perfect commercial food styling.
```
