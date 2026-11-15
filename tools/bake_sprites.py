#!/usr/bin/env python3
"""생성한 스프라이트를 게임에 넣는다.

art/generated/*.png 를 투명 여백을 잘라내고 게임에 맞는 크기로 줄여 prototype/sprites/ 에 넣고,
prototype/sprites.js 의 BUNDLED 목록을 갱신한다. 그림을 다시 생성했으면 이 스크립트를 다시 돌리면 된다.

  python3 tools/bake_sprites.py            # art/generated 에 있는 것 전부
  python3 tools/bake_sprites.py cat:stray  # 일부만 (BUNDLED 목록은 전체 기준으로 갱신)

macOS 기본 도구 sips 를 쓴다 (추가 설치 없음).
"""
import hashlib, json, re, struct, subprocess, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / 'art' / 'generated'
OUT = ROOT / 'prototype' / 'sprites'
SPEC = ROOT / 'art' / 'sprites.json'
SPRITES_JS = ROOT / 'prototype' / 'sprites.js'
# 긴 변 최대 픽셀. 게임 속 크기의 3~4배 (고해상도 화면 대비)
MAX = {'char': 256, 'cat': 256, 'walk': 256, 'part': 96, 'pick': 160, 'icon': 128, 'proj': 160, 'fx': 512}
MAX_KEY = {'cat:king': 320, 'cat:cheese': 288, 'cat:sam': 288, 'cat:tux': 288,
           'wep:feather': 384, 'wep:pinwheel': 384, 'wep:tornado': 384, 'wep:mirrorball': 128,
           'zone:puddle': 320, 'fx:ring': 384}


def alpha_bbox(path, thr=8):
    """투명하지 않은 영역 (x0, y0, x1, y1). RGBA 8비트 비인터레이스 PNG만, 아니면 None."""
    d = path.read_bytes()
    w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', d[16:29])
    if bd != 8 or ct != 6 or il != 0:
        return None
    idat, i = bytearray(), 8
    while i < len(d):
        n = struct.unpack('>I', d[i:i+4])[0]; t = d[i+4:i+8]
        if t == b'IDAT': idat += d[i+8:i+8+n]
        i += 12 + n
    raw = zlib.decompress(bytes(idat)); stride = w * 4
    prev = bytearray(stride); pos = 0
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        f = raw[pos]; line = bytearray(raw[pos+1:pos+1+stride]); pos += 1 + stride
        if f == 1:
            for x in range(4, stride): line[x] = (line[x] + line[x-4]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride): line[x] = (line[x] + (((line[x-4] if x >= 4 else 0) + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-4] if x >= 4 else 0; b = prev[x]; c = prev[x-4] if x >= 4 else 0
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        alphas = line[3::4]
        if max(alphas) > thr:
            xs = [x for x, a in enumerate(alphas) if a > thr]
            x0 = min(x0, xs[0]); x1 = max(x1, xs[-1]); y0 = min(y0, y); y1 = y
        prev = line
    if x1 < 0:
        return None
    return x0, y0, x1, y1, w, h


def sips(*args):
    r = subprocess.run(['sips', *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())


def partner(key):
    """걷기 프레임과 기본 그림은 서로 짝. 짝끼리 같은 영역으로 잘라야 번갈아 그릴 때 크기가 튀지 않는다."""
    if key.startswith('walk:'):
        t = key[5:]; return 'player' if t == 'player' else 'cat:' + t
    if key == 'player': return 'walk:player'
    if key.startswith('cat:'): return 'walk:' + key[4:]
    return None


def bake(item, by_key):
    src = GEN / item['file']; dst = OUT / item['file']
    box = alpha_bbox(src)
    mate = by_key.get(partner(item['key']) or '')
    if box and mate and (GEN / mate['file']).exists():
        b2 = alpha_bbox(GEN / mate['file'])
        if b2 and b2[4:] == box[4:]:
            box = (min(box[0], b2[0]), min(box[1], b2[1]), max(box[2], b2[2]), max(box[3], b2[3]), box[4], box[5])
    tmp = OUT / ('_tmp_' + item['file'])
    if box:
        x0, y0, x1, y1, w, h = box
        pad = 4
        x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(w - 1, x1 + pad); y1 = min(h - 1, y1 + pad)
        cw, ch = x1 - x0 + 1, y1 - y0 + 1
        sips('-c', str(ch), str(cw), '--cropOffset', str(y0), str(x0), str(src), '--out', str(tmp))
    else:
        tmp.write_bytes(src.read_bytes()); cw = ch = None
    m = MAX_KEY.get(item['key'], MAX_KEY.get(partner(item['key']) or '', MAX.get(item['group'], 256)))
    sips('-Z', str(m), str(tmp), '--out', str(dst))
    tmp.unlink(missing_ok=True)
    return cw, ch, dst.stat().st_size


def main():
    spec = json.loads(SPEC.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    want = set(sys.argv[1:])
    by_key = {it['key']: it for it in spec['items']}
    total = 0
    for it in spec['items']:
        if want and it['key'] not in want and it['file'][:-4] not in want:
            continue
        if not (GEN / it['file']).exists():
            continue
        cw, ch, size = bake(it, by_key)
        total += size
        print(f'  {it["key"]:<18} 잘라낸 크기 {cw}×{ch} → {size/1024:.0f}KB')
    bundled = [it['key'] for it in spec['items'] if (OUT / it['file']).exists()]
    js = SPRITES_JS.read_text(encoding='utf-8')
    vers = {k: hashlib.sha1((OUT / by_key[k]['file']).read_bytes()).hexdigest()[:8] for k in bundled}
    js, n = re.subn(r"const BUNDLED_V = \{[^}]*\};", lambda _: "const BUNDLED_V = " + json.dumps(vers, separators=(',', ':')) + ";", js)
    if n != 1:
        sys.exit('sprites.js 에서 BUNDLED 줄을 찾지 못했다.')
    SPRITES_JS.write_text(js, encoding='utf-8')
    allsize = sum((OUT / it['file']).stat().st_size for it in spec['items'] if (OUT / it['file']).exists())
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'stamp_versions.py')], check=True, capture_output=True)
    print(f'\n게임에 들어간 그림 {len(bundled)}개 · 합계 {allsize/1024/1024:.1f}MB · prototype/sprites.js 목록 갱신')


if __name__ == '__main__':
    main()
