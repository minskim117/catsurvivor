#!/usr/bin/env python3
"""index.html · admin.html 의 <script src="balance.js"> / "sprites.js" 에 내용 해시(?v=)를 붙인다.
파일이 바뀌면 주소가 바뀌어 브라우저 캐시에 남은 옛 버전을 쓰지 않는다. 게시 전에 실행한다 (bake_sprites.py 도 끝에 부른다)."""
import hashlib, re
from pathlib import Path
P = Path(__file__).resolve().parent.parent / 'prototype'
for html in ('index.html', 'admin.html'):
    p = P / html; s = p.read_text(encoding='utf-8')
    for js in ('balance.js', 'sprites.js'):
        v = hashlib.sha1((P / js).read_bytes()).hexdigest()[:8]
        s = re.sub(r'<script src="%s(\?v=[0-9a-f]*)?"></script>' % re.escape(js), '<script src="%s?v=%s"></script>' % (js, v), s)
    p.write_text(s, encoding='utf-8')
    print(html, re.findall(r'<script src="[^"]+"', s))
