#!/usr/bin/env python3
"""냥이를 뚫고 등교하라 · 스프라이트 생성기

art/reference/ 의 직접 만든 그림을 참고로 OpenAI 이미지 API(편집 엔드포인트)를 불러
관리자 페이지 스프라이트 탭의 그림을 같은 그림체로 만든다. 결과는 art/generated/ 에
카드 이름 그대로(cat_stray.png 등) 저장되어, 관리자 페이지에서 한꺼번에 가져올 수 있다.

추가 설치 없이 파이썬 기본 라이브러리만 쓴다.

  python3 tools/gen_sprites.py --list                  # 목록과 생성 여부
  python3 tools/gen_sprites.py --only cat:stray --dry-run   # 보낼 내용만 확인 (요금 없음)
  python3 tools/gen_sprites.py --only cat:stray        # 한 장만 생성
  python3 tools/gen_sprites.py --group cat             # 그룹 전체 (char, cat, walk, pick, icon, proj, fx)
  python3 tools/gen_sprites.py --all                   # 아직 없는 것 전부
  python3 tools/gen_sprites.py --only player --force   # 이미 있어도 다시 생성

설정: 프로젝트 폴더의 .env
  OPENAI_API_KEY=...            (필수)
  OPENAI_IMAGE_MODEL=...        (선택, 기본 gpt-image-2.5-sunburst)
"""
import argparse, base64, json, mimetypes, os, random, sys, time, uuid
import urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art'
REF = ART / 'reference'
OUT = ART / 'generated'
SPEC = ART / 'sprites.json'
API_URL = 'https://api.openai.com/v1/images/edits'
DEFAULT_MODEL = 'gpt-image-2.5-sunburst'
MAX_REFS = 8                      # API는 최대 16장. 많을수록 느리고 비싸서 8장으로 줄인다
IMG_EXT = {'.png', '.jpg', '.jpeg', '.webp'}
CAT_TYPES = ['baby', 'stray', 'dash', 'fat', 'black', 'wall', 'elite', 'cheese', 'sam', 'tux', 'king']


def load_env():
    env = {}
    p = ROOT / '.env'
    if p.exists():
        for line in p.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ('OPENAI_API_KEY', 'OPENAI_IMAGE_MODEL'):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def images_in(folder):
    d = REF / folder
    if not d.is_dir():
        return []
    return sorted(p for p in d.iterdir() if p.suffix.lower() in IMG_EXT and not p.name.startswith('.'))


def refs_for(item):
    """참고 그림 고르기: 고양이는 이름이 맞는 그림을 맨 앞에, 나머지는 폴더 순서대로."""
    picked = [OUT / (r[1:] + '.png') for r in item['refs'] if r.startswith('@')]
    missing = [p for p in picked if not p.exists()]
    if missing:
        raise RuntimeError('먼저 생성해야 하는 그림: ' + ', '.join(p.name for p in missing))
    if item['group'] == 'walk':
        return picked
    if item['group'] == 'cat':
        t = item['key'].split(':', 1)[1]
        named = [p for p in images_in('cats') if p.stem == t or p.stem.startswith(t + '_')]
        others = [p for p in images_in('cats') if p.stem.split('_')[0] not in CAT_TYPES]
        picked += named + others
    else:
        for f in item['refs']:
            if not f.startswith('@'):
                picked += images_in(f)
    picked += images_in('style')
    seen, out = set(), []
    for p in picked:
        if p not in seen:
            seen.add(p); out.append(p)
    return out[:MAX_REFS]


def build_prompt(spec, item):
    rule = spec['group_rules'].get(item['group'], '')
    cat_note = ''
    if item['group'] == 'cat':
        t = item['key'].split(':', 1)[1]
        if any(p.stem == t or p.stem.startswith(t + '_') for p in images_in('cats')):
            cat_note = ' The FIRST reference image shows this exact cat: keep its look, markings and colors.'
    return f"{spec['style']}\n{rule}{cat_note}\nSubject: {item['prompt']}"


def multipart(fields, files):
    boundary = '----nyang' + uuid.uuid4().hex
    out = bytearray()
    for k, v in fields:
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode('utf-8')
    for k, path in files:
        ctype = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        safe = 'ref' + path.suffix.lower()          # 한글 파일 이름도 문제없게
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{safe}"\r\nContent-Type: {ctype}\r\n\r\n'.encode('utf-8')
        out += path.read_bytes() + b'\r\n'
    out += f'--{boundary}--\r\n'.encode('utf-8')
    return bytes(out), f'multipart/form-data; boundary={boundary}'


def call_api(key, model, prompt, refs, size, quality):
    fields = [('model', model), ('prompt', prompt), ('size', size), ('quality', quality),
              ('background', 'transparent'), ('output_format', 'png'), ('n', '1')]
    body, ctype = multipart(fields, [('image[]', p) for p in refs])
    for attempt in range(5):
        req = urllib.request.Request(API_URL, data=body, method='POST',
                                     headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')
            try:
                detail = json.loads(detail)['error']['message']
            except Exception:
                pass
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                wait = 2 ** attempt * 5 + random.random() * 3
                print(f'    API {e.code}, {wait:.0f}초 뒤 다시 시도: {detail[:160]}')
                time.sleep(wait); continue
            raise RuntimeError(f'API 오류 {e.code}: {detail}') from None
        except urllib.error.URLError as e:
            if attempt < 4:
                time.sleep(5); continue
            raise RuntimeError(f'연결 실패: {e.reason}') from None


def find_items(spec, args):
    items = spec['items']
    by = {}
    for it in items:
        by[it['key']] = it; by[it['file'][:-4]] = it
    if args.only:
        sel = []
        for name in [s.strip() for s in args.only.split(',') if s.strip()]:
            if name not in by:
                sys.exit(f'모르는 이름: {name}  (python3 tools/gen_sprites.py --list 로 확인)')
            sel.append(by[name])
        return sel
    if args.group:
        groups = {g.strip() for g in args.group.split(',')}
        bad = groups - {it['group'] for it in items}
        if bad:
            sys.exit(f'모르는 그룹: {", ".join(bad)}  (char, cat, walk, pick, icon, proj, fx)')
        return [it for it in items if it['group'] in groups]
    if args.all:
        return items
    return None


def main():
    ap = argparse.ArgumentParser(description='참고 그림으로 게임 스프라이트를 생성한다.')
    ap.add_argument('--list', action='store_true', help='목록과 생성 여부만 보여 준다')
    ap.add_argument('--only', help='생성할 그림. 쉼표로 여러 개 (예: player,cat:stray 또는 cat_stray)')
    ap.add_argument('--group', help='그룹 전체: char, cat, walk, pick, icon, proj, fx (쉼표로 여러 개)')
    ap.add_argument('--all', action='store_true', help='68개 전부')
    ap.add_argument('--force', action='store_true', help='이미 생성된 그림도 다시 만든다')
    ap.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'], help='기본 medium')
    ap.add_argument('--model', help=f'기본: .env의 OPENAI_IMAGE_MODEL 또는 {DEFAULT_MODEL}')
    ap.add_argument('--dry-run', action='store_true', help='API를 부르지 않고 보낼 내용만 보여 준다')
    ap.add_argument('--yes', '-y', action='store_true', help='시작 전 확인을 건너뛴다')
    args = ap.parse_args()

    spec = json.loads(SPEC.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)

    if args.list:
        cur = None
        for it in spec['items']:
            if it['group'] != cur:
                cur = it['group']; print(f'\n[{cur}]')
            done = '✓' if (OUT / it['file']).exists() else ' '
            print(f'  {done} {it["key"]:<18} {it["name"]}')
        n = sum((OUT / it['file']).exists() for it in spec['items'])
        print(f'\n생성됨 {n} / {len(spec["items"])}')
        return

    sel = find_items(spec, args)
    if sel is None:
        ap.print_help(); sys.exit('\n무엇을 만들지 --only, --group, --all 중 하나로 정해 주세요.')
    todo = [it for it in sel if args.force or not (OUT / it['file']).exists()]
    skipped = len(sel) - len(todo)
    if not todo:
        print(f'이미 모두 생성되어 있다 ({skipped}개). 다시 만들려면 --force'); return

    env = load_env()
    model = args.model or env.get('OPENAI_IMAGE_MODEL') or DEFAULT_MODEL
    key = env.get('OPENAI_API_KEY', '')
    if not args.dry_run and not key:
        sys.exit('.env 의 OPENAI_API_KEY 가 비어 있다. 키를 넣고 저장한 뒤 다시 실행해 주세요.')
    if not images_in('character') and not images_in('cats'):
        sys.exit('art/reference/ 에 참고 그림이 없다.')

    print(f'생성할 그림 {len(todo)}개' + (f' (이미 있는 {skipped}개는 건너뜀)' if skipped else '') + f' · 모델 {model} · 품질 {args.quality}')
    if args.dry_run:
        for it in todo:
            print(f'\n── {it["key"]} → art/generated/{it["file"]}  ({it["size"]})')
            print('  참고:', ', '.join(str(p.relative_to(ROOT)) for p in refs_for(it)) or '(없음)')
            print('  프롬프트:\n    ' + build_prompt(spec, it).replace('\n', '\n    '))
        print('\n(dry-run: API는 부르지 않았다)'); return
    if not args.yes:
        if input('OpenAI 요금이 발생한다. 시작할까요? [y/N] ').strip().lower() not in ('y', 'yes'):
            print('취소했다.'); return

    log = OUT / '_log.jsonl'
    ok = fail = 0
    for i, it in enumerate(todo, 1):
        refs = refs_for(it)
        print(f'[{i}/{len(todo)}] {it["key"]} ({it["name"]}) · 참고 {len(refs)}장 …', flush=True)
        t0 = time.time()
        try:
            res = call_api(key, model, build_prompt(spec, it), refs, it['size'], args.quality)
            b64 = res['data'][0]['b64_json']
            (OUT / it['file']).write_bytes(base64.b64decode(b64))
            usage = res.get('usage', {})
            with log.open('a', encoding='utf-8') as f:
                f.write(json.dumps({'key': it['key'], 'file': it['file'], 'model': model, 'quality': args.quality,
                                    'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'usage': usage}, ensure_ascii=False) + '\n')
            ok += 1
            print(f'    저장: art/generated/{it["file"]}  ({time.time()-t0:.0f}초, 토큰 {usage.get("total_tokens", "?")})')
        except Exception as e:
            fail += 1
            print(f'    실패: {e}')
            if 'API 오류 401' in str(e) or 'API 오류 403' in str(e):
                sys.exit('키가 잘못되었거나 권한이 없다. .env 를 확인해 주세요.')
    print(f'\n끝: 성공 {ok}, 실패 {fail}. 관리자 페이지 스프라이트 탭의 "여러 장 한꺼번에 가져오기"로 art/generated/ 의 파일을 고르면 된다.')


if __name__ == '__main__':
    main()
