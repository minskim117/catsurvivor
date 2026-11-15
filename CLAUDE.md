# 냥이를 뚫고 등교하라 · 작업 안내 (Claude Code용)

학생이 등굣길 고양이 떼를 츄르와 장난감으로 만족시키며 15분을 버티는 탑다운 서바이벌 게임 프로토타입이다. 브라우저 HTML5 캔버스, 휴대폰 세로(9:16) 기준. 빌드 과정 없음.

- 사용자에게는 **한국어**로 답한다.
- 사용자는 게임 기획자다. 바꾼 것은 화면에서 확인한 뒤 결과를 짧게 알린다.

## 링크

- 게임 아티팩트 (관리자 페이지 포함): https://claude.ai/artifact/JggyV4kEDU7cwX4FejcPUA
- 게임 기획서 (Claude Docs, 탭 5개): https://claude.ai/artifact/3yQbp6FiAki1xv2vZaZr67
  - `docs/`의 마크다운은 내보낸 사본이다. 기획을 바꾸면 Claude Docs 원본을 고치고, 필요하면 `docs/`도 다시 내보낸다.
- GitHub: https://github.com/minskim117/catsurvivor (main 브랜치)

## 구조

| 경로 | 내용 |
|---|---|
| `prototype/index.html` | 게임 본체 (한 파일, IIFE 안에 전부) |
| `prototype/admin.html` | 관리자 페이지: 무기 밸런스 탭, 스프라이트 탭 |
| `prototype/balance.js` | 무기(WEAPONS)·패시브·고양이(CATS) 수치, 조정값(TUNE_DEF/K), 밸런스 저장·적용 |
| `prototype/sprites.js` | 모든 그림 그리기(캐릭터·고양이·아이템·투사체·장판·이펙트), 그림 교체, CATALOG, BUNDLED_V |
| `prototype/sprites/` | 게임에 들어간 스프라이트 (bake 결과물, 직접 수정 금지) |
| `art/generated/` | 생성 원본 1024px. `art/sprites.json`이 목록·프롬프트 |
| `art/reference/` | 사용자가 그린 참고 그림 (character/, cats/, style/) |
| `tools/` | `gen_sprites.py`(생성), `bake_sprites.py`(굽기), `stamp_versions.py`(캐시 방지) |

스크립트 순서: `index.html`·`admin.html`은 `balance.js` → `sprites.js` → 본체 순으로 읽는다. 둘 다 `window.NYANG_BAL`, `window.NYANG_SPR`로 노출된다.

## 실행과 확인

```bash
python3 -m http.server 8765 --directory prototype
```

- `.claude/launch.json`에 `prototype` 설정이 있다 (브라우저 패널 preview_start).
- 게임 `/`, 관리자 `/admin.html`. 특정 무기 테스트: `/index.html?test=mouse&lv=8` (진화·상위 진화 id도 가능, 기록 안 남음).
- 디버그 훅: `window.__nyang` → `G`, `mode`, `step(초)`, `startRun(id)`, `spawnCat(type,x,y)`, `openLevelUp()`, `CATS`.
- 브라우저 패널이 숨겨져 있으면 rAF가 멈추고 blur로 일시정지된다. 시뮬레이션은 `__nyang.step()`으로 돌리고, 화면 확인 전에 오버레이를 숨긴다.
- 파일을 바꾼 뒤 로컬 확인 시 `fetch(파일, {cache:'reload'})` 후 새로고침해야 캐시가 갱신된다.

## 게시 (아티팩트 업데이트)

1. 코드나 그림을 바꿨으면 `python3 tools/stamp_versions.py` (그림을 구웠으면 bake가 자동으로 부른다).
2. Artifact 도구로 `prototype/index.html`을 위 게임 URL에 publish 하고, 바뀐 부속 파일을 `files`로 함께 보낸다.
   - 예: `{"admin.html": "prototype/admin.html", "balance.js": "prototype/balance.js", "sprites.js": "prototype/sprites.js", "sprites/cat_stray_walk_1.png": "prototype/sprites/cat_stray_walk_1.png"}`
   - 이름이 바뀌어 없어진 파일은 `null`로 지운다.
   - `files` 경로는 현재 작업 폴더 기준이다 (폴더가 바뀌면 `prototype/` 접두어 확인).
3. 공개 링크는 claude.ai 로그인이 필요해 직접 열어 보지 못할 수 있다. 그 사실을 사용자에게 말한다.

## 스프라이트 규칙

- 우선순위: 관리자 페이지에서 올린 그림(IndexedDB `nyang-sprites`) > 게임 기본 그림(`prototype/sprites/`) > 코드로 그린 옛 그림.
- **학생·고양이 그림은 왼쪽을 보게 그린다.** 코드는 `scale(-faceX/-fx)`로 이동 방향에 맞춰 뒤집는다. 다른 그림(투사체·날개 등)은 오른쪽 기준.
- 걷기: 걷기 1(기본)과 걷기 2를 번갈아 그린다. 크기 변화(스쿼시)는 쓰지 않는다. bake가 짝을 같은 영역으로 잘라 크기가 튀지 않게 한다.
- 파일 이름: `player_walk_1/2.png`, `cat_<종류>_walk_1/2.png`, 나머지는 `<그룹>_<이름>.png` (예: `pick_coin.png`, `icon_churu.png`). 내부 키는 `player`, `walk:player`, `cat:stray`, `walk:stray`, `pick:coin` 등 (`sprites.js`의 `fileOf`).
- 그림 주소에는 내용 해시(`?v=`)가 붙는다. 그림을 바꾸면 반드시 bake를 다시 돌려 `BUNDLED_V`를 갱신한다.
- 맞을 때 빨강·분무기 동안 하늘색·피격 순간 흰색은 원이 아니라 그림 색을 바꾼다 (`tinted`).
- 그림자 없음. 대장 고양이(엘리트)는 택배상자를 머리에 쓴 그림이다.

### 생성과 굽기

```bash
python3 tools/gen_sprites.py --list
python3 tools/gen_sprites.py --only cat:stray --dry-run      # 요금 없음
python3 tools/gen_sprites.py --only cat:stray --force --yes  # OpenAI 요금 발생
python3 tools/bake_sprites.py                                # prototype/sprites/ 갱신
```

- 키는 `.env`의 `OPENAI_API_KEY` (모델 기본 `gpt-image-2.5-sunburst`, 투명 배경).
- 생성은 사용자 OpenAI API 계정에서 요금이 나간다 (한 장 약 2~3센트 추정). 여러 장을 만들기 전에는 사용자에게 확인한다.
- 생성 결과는 반드시 눈으로 확인한다 (방향, 투명 배경, 원본과의 일관성). 걷기 2는 걷기 1을 참고 그림으로 쓴다(`refs: ["@cat_stray_walk_1"]`).

## 게임 규칙 요약 (자세한 것은 기획서)

- 한 판 15분 (`RUN = 900`). 난이도 곡선은 예전 20분 기준을 `TS = 1200 / RUN`으로 압축.
- 타임라인: 02:00 첫 엘리트(이후 1분마다) · 04:00 보스1 치즈 · 05:00 횡단 · 07:30 보스2 삼색이(진화 개방) · 09:00 담벼락 · 10:00 횡단 · 11:00 보스3 턱시도(상위 진화 개방) · 12:30 대이동 · 13:30 최종 보스 왕고양이 · 15:00 정문.
- 지각 엔딩 구간: 4분 미만 / 4~11분 / 11~15분.
- 무기 8종의 공격 방식과 Lv1~8 수치는 뱀파이어 서바이버즈의 대응 무기를 그대로 따른다 (`balance.js`의 `ref`: Magic Wand, Whip, Runetracer, Santa Water, Axe, King Bible, Garlic, Fire Wand). 수치를 바꾸면 기획서 '무기 레벨업 수치' 탭도 맞춘다.
- 진화·상위 진화 무기는 아직 원본 대응 없이 고정값(`TUNE_DEF`)만 있다.
- 캣닢 장판은 파티클(잎·꽃·반짝이)로 그린다. 수치는 `TUNE_DEF.catnip`의 `p*` 값.
- UI: 레벨업 팝업 제목 "레벨 업", 아이템 설명은 2줄 이내(카드용 짧은 설명 `sd`), 게임 중 팝업은 가운데 정렬, 일시정지 아래 2배속 버튼.

## 저장 위치 (브라우저마다 따로)

- `localStorage`: `nyang-save-v1`(도감·용돈·꾸미기), `nyang-best`, `nyang-tune-v1`(관리자 밸런스 변경분), `nyang-admin-*`(관리자 화면 상태)
- IndexedDB `nyang-sprites`: 관리자 페이지에서 올린 그림
- 관리자에서 바꾼 밸런스를 기본값으로 굳히려면 사용자가 "내보내기" JSON을 주고, 그 값을 `balance.js` 기본값에 반영한다.

## 하지 말 것

- `.env`(API 키)를 커밋하거나 출력하지 않는다. 키 값은 마스킹해서만 확인한다.
- `prototype/sprites/`를 손으로 고치지 않는다 (원본은 `art/generated/`, bake로 만든다).
- 사용자 이메일을 커밋이나 외부 요청에 넣지 않는다. 커밋 작성자는 `minskim117 <minskim117@users.noreply.github.com>` (저장소 로컬 설정).
- 이 Mac은 배포 키(`~/.ssh/catsurvivor_deploy`, `core.sshCommand`로 지정)로 push 한다. 다른 컴퓨터에서는 그 컴퓨터의 GitHub 인증을 쓴다.
