# 이미지 자산

`public/og.png`는 이 게임 전용으로 built-in imagegen을 사용해 생성한 1536×1024 공유 표지입니다. 외부 사진이나 상용 게임 자산은 사용하지 않았습니다. 배경에 생긴 불필요한 건물명과 문서 글씨를 1회 수정했으며 제목과 부제의 한글을 시각적으로 확인했습니다.

최초 생성 프롬프트:

> Use case: ads-marketing. Create one finished landscape social sharing card for an original Korean browser mystery game. Title exact Korean text: "삭제된 게시판". Small English label exact: "DELETED BOARD". Small footer exact Korean: "8개의 사건, 하나의 진실". Palette deep nearly black teal #0c191b, warm ivory #f4efe4, muted coral #f17a61. Large beautifully typeset Korean title on left, fine ivory horizontal rules, small archival label 0318. On right cinematic analog archival collage: paper apartment community notices, redacted lines, a rusted paperclip, small grainy photograph of a quiet Korean apartment building at night with a single amber lit window. Sophisticated editorial typography, subtle paper grain, restrained and immersive, excellent legibility at small thumbnail sizes. No extra text, no UI buttons, no logos or watermarks. Entire finished composition with text integrated, 1536x1024 or landscape aspect.

최종 수정 프롬프트:

> Edit this social card. Preserve the entire composition, paper textures, dark teal and coral colors, apartment photograph, and these exact existing title texts: 삭제된 게시판 / DELETED BOARD / 8개의 사건, 하나의 진실 / 0318. Important correction: Remove ALL OTHER readable text and building names and numbers from the apartment photograph and from all background paper notices. Replace writing on background notices with abstract blurred ink lines or solid redaction lines, not legible letters. The depicted building should have no name or number. Keep the four specified title/label texts unchanged and sharp. No added words.

게임 UI는 CSS, 텍스트, 기본 문자 기호와 아래 사진으로 구성합니다. 프롤로그 이미지는 사건의 분위기를 표현하는 연출 장면이며, 수치·동선·계정 등 판정 근거는 게시글의 텍스트와 표로 제공합니다.

주민 사진 6장과 에피소드별 장면 8장의 출처·프롬프트는 [IMMERSION_ASSETS.md](IMMERSION_ASSETS.md)에 기록했습니다.
