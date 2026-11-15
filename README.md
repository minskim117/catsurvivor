# 냥이를 뚫고 등교하라

지각 직전의 학생이 등굣길을 막는 고양이 떼를 츄르와 장난감으로 만족시키며 15분을 버티는 탑다운 서바이벌 게임 프로토타입. 브라우저에서 바로 돌아가는 HTML5 캔버스 게임이며, 휴대폰 세로 화면(9:16)에 맞춰 만들었다.

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `prototype/index.html` | 게임 본체 |
| `prototype/admin.html` | 관리자 페이지: 무기 밸런스 조정, 스프라이트 보기·교체 |
| `prototype/balance.js` | 무기·패시브·고양이 수치 (게임과 관리자 페이지가 함께 씀) |
| `prototype/sprites.js` | 캐릭터·고양이·아이템·이펙트 그리기와 그림 교체 |
| `prototype/sprites/` | 게임에 들어간 스프라이트 82장 (작게 줄인 것) |
| `art/reference/` | 직접 그린 참고 그림 (캐릭터·고양이) |
| `art/generated/` | 이미지 생성으로 만든 원본 스프라이트 (1024px) |
| `art/sprites.json` | 스프라이트 목록과 생성 프롬프트 |
| `tools/gen_sprites.py` | 참고 그림으로 스프라이트를 생성하는 스크립트 (OpenAI 이미지 API) |
| `tools/bake_sprites.py` | 생성한 원본을 잘라내고 줄여 `prototype/sprites/`에 넣는 스크립트 |
| `tools/stamp_versions.py` | 스크립트 주소에 버전 해시를 붙여 브라우저 캐시 문제를 막음 |
| `docs/` | 게임 기획서 (Claude Docs에서 내보낸 마크다운) |

## 실행

빌드 과정이 없다. `prototype` 폴더를 정적 서버로 열면 된다.

```bash
python3 -m http.server 8765 --directory prototype
```

브라우저에서 `http://localhost:8765/` 가 게임, `http://localhost:8765/admin.html` 이 관리자 페이지다.

## 스프라이트 다시 만들기

1. `.env.example`을 복사해 `.env`를 만들고 `OPENAI_API_KEY`를 넣는다. `.env`는 저장소에 올라가지 않는다.
2. 참고 그림을 `art/reference/`에 넣는다. 자세한 규칙은 [art/README.md](art/README.md).
3. 생성하고 게임에 넣는다.

```bash
python3 tools/gen_sprites.py --only cat:stray --dry-run   # 보낼 내용 확인 (요금 없음)
python3 tools/gen_sprites.py --only cat:stray --force     # 한 장 다시 생성
python3 tools/bake_sprites.py                             # 게임에 넣기
```

## 기획서

- [게임 기획서](docs/01-기획서.md)
- [무기 레벨업 수치](docs/02-무기-레벨업-수치.md) · [패시브 레벨업 수치](docs/03-패시브-레벨업-수치.md)
- [고양이 도감](docs/04-고양이-도감.md) · [무기·패시브 도감](docs/05-무기-패시브-도감.md)

무기 공격 방식과 레벨별 수치는 뱀파이어 서바이버즈의 비슷한 무기를 참고했다 (각 무기의 원본은 무기 레벨업 수치 문서에 적혀 있다).
