# 그림 폴더

이미지 생성 때 참고할 그림과 생성 결과를 두는 곳이다. prototype/ 밖이라 게임·아티팩트에는 올라가지 않는다.

## reference/character/
직접 만든 캐릭터(학생) 그림을 넣는다. 생성되는 모든 스프라이트가 이 그림의 그림체·선 굵기·색감을 따른다.
- PNG 권장, 투명 배경이면 더 좋다.
- 여러 장이면 정면·옆모습·전신처럼 각도가 다른 것을 넣으면 일관성이 좋아진다.
- 파일 이름은 자유. 예: student_front.png, student_side.png

## reference/cats/
직접 만든 고양이 그림을 넣는다. 고양이 스프라이트를 만들 때 이 그림의 생김새와 그림체를 따른다.
- 특정 고양이를 그린 것이면 파일 이름을 그 고양이로 지으면 그 그림을 기준으로 만든다.
  baby(아기 고양이) · stray(길냥이) · dash(우다다 냥이) · fat(뚱냥이) · black(검은 고양이 무리) · wall(담벼락 냥이)
  elite(대장 고양이) · cheese(뚱보 치즈) · sam(골목대장 삼색이) · tux(냥아치 대장 턱시도) · king(등교 저지 위원장 왕고양이)
  예: stray.png, cheese_1.png, cheese_2.png
- 특정 고양이가 아닌 그림체 참고용이면 이름은 자유. 예: cat_style_01.png

## reference/style/
캐릭터 말고도 따라 했으면 하는 그림체 예시(색 팔레트, 다른 소품 그림 등)가 있으면 넣는다. 없어도 된다.

## generated/
생성된 스프라이트가 저장될 곳. 관리자 페이지 스프라이트 탭에 보이는 파일 이름 그대로 저장된다.
- 학생·고양이: 걷기 1은 player_walk_1.png, cat_baby_walk_1.png / 걷기 2는 끝이 _walk_2.png
- 나머지: pick_coin.png, icon_churu.png 처럼 종류_이름.png

## 생성 스크립트 (tools/gen_sprites.py)
프로젝트 폴더(catsurvivor)에서 터미널로 실행한다. .env 에 OPENAI_API_KEY 가 있어야 한다.

    python3 tools/gen_sprites.py --list                        # 목록과 생성 여부
    python3 tools/gen_sprites.py --only cat_stray_walk_1 --dry-run   # 보낼 내용만 확인 (요금 없음). cat:stray 처럼 키로 써도 된다
    python3 tools/gen_sprites.py --only cat:stray              # 한 장 생성
    python3 tools/gen_sprites.py --group cat                   # 그룹 전체: char, cat, pick, icon, proj, fx
    python3 tools/gen_sprites.py --all                         # 아직 없는 것 전부
    python3 tools/gen_sprites.py --only player --force         # 이미 있어도 다시 생성
    python3 tools/gen_sprites.py --only player --quality high  # 품질: low, medium(기본), high

- 프롬프트는 art/sprites.json 에서 고친다. style 이 모든 그림에 공통으로 붙고, items 의 prompt 가 그림마다 붙는다.
- 이미 만든 그림은 건너뛰므로 --all 을 다시 돌려도 새로 추가된 것만 만든다.
- 쓴 토큰은 art/generated/_log.jsonl 에 남는다.
- 다 만들면 관리자 페이지 스프라이트 탭 → "여러 장 한꺼번에 가져오기" → art/generated/ 의 파일을 모두 고른다.
