/* 냥이를 뚫고 등교하라 · 스프라이트
   캐릭터·고양이·필드 아이템·무기 아이콘을 그린다. 관리자 페이지(admin.html)에서 그림 파일로 교체하면
   이 브라우저의 IndexedDB('nyang-sprites')에 저장되고, 게임은 기본 그림 대신 그 파일을 그린다.
   balance.js 다음에 불러온다. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const { CATS, WEAPONS, PASSIVES, EVOS, UPPERS } = window.NYANG_BAL;
let ctx = null;
const use = c => { ctx = c; };

const HAIR_COLORS = ['#2b2730','#5a3a28','#8a5a2b','#c98b3a','#e6c35a','#c0504d','#6b5bb5','#d9d6ce'];
const SKINS = ['#ffdcbf','#f3c49b','#d9a172','#a8714a'];
const PICK_BOX = { coin:18, food:24, vacuum:28, cucumber:28, spray:24, chest:40 };

/* ---------- 교체 그림 ---------- */
/* IMG = 실제로 그릴 그림. 우선순위: 관리자에서 올린 그림(OVR) > 게임에 들어 있는 생성 그림(BASE) > 코드로 그린 원래 그림.
   META[key].off 이면 생성 그림도 끄고 원래 그림을 쓴다. */
const IMG = {}, OVR = {}, BASE = {}, URLS = {}, META = {}, listeners = new Set();
function pickImg(key){ const m = META[key]; if (m && m.off) delete IMG[key]; else if (OVR[key]) IMG[key] = OVR[key]; else if (BASE[key]) IMG[key] = BASE[key]; else delete IMG[key]; }
let ready = false;
/* x 가운데, bottom 바닥 기준으로 bw×bh 상자 안에 비율을 지켜 그린다 */
function fitDraw(im, x, bottom, bw, bh){
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s = Math.min(bw / iw, bh / ih), w = iw * s, h = ih * s;
  ctx.drawImage(im, x - w/2, bottom - h, w, h);
}
/* 그림 자체의 색을 바꾼다 (맞았을 때 빨강, 분무기에 얼었을 때 하늘색, 피격 순간 흰색) */
const TINTS = { hurt:'rgba(255,40,70,.55)', freeze:'rgba(110,190,255,.55)', flash:'rgba(255,255,255,.75)' };
const tintCache = new WeakMap();
function tinted(im, kind){
  if (!kind || !TINTS[kind]) return im;
  let m = tintCache.get(im); if (!m){ m = {}; tintCache.set(im, m); }
  if (!m[kind]){ const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = TINTS[kind]; g.fillRect(0, 0, c.width, c.height); m[kind] = c; }
  return m[kind];
}
const DB_NAME = 'nyang-sprites', STORE = 'img';
let dbp = null;
function openDb(){
  if (!dbp) dbp = new Promise((res, rej) => {
    let r; try { r = indexedDB.open(DB_NAME, 1); } catch(e){ rej(e); return; }
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
function req(mode, fn){
  return openDb().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE));
    t.oncomplete = () => res(q ? q.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
function setImg(key, rec){
  if (URLS[key]) URL.revokeObjectURL(URLS[key]);
  delete URLS[key]; delete OVR[key]; delete META[key];
  if (rec && rec.off){ META[key] = { off:true, t:rec.t || 0 }; pickImg(key); return Promise.resolve(); }
  if (!rec || !rec.blob){ pickImg(key); return Promise.resolve(); }
  const url = URL.createObjectURL(rec.blob);
  return new Promise(res => { const im = new Image();
    im.onload = () => { URLS[key] = url; OVR[key] = im; META[key] = { w:rec.w, h:rec.h, name:rec.name || '', t:rec.t || 0 }; pickImg(key); res(); };
    im.onerror = () => { URL.revokeObjectURL(url); pickImg(key); res(); }; im.src = url; });
}
function emit(key){ for (const fn of listeners) try { fn(key); } catch(e){ console.error(e); } }
const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('nyang-sprites') : null;
if (bc) bc.onmessage = e => { const key = e.data && e.data.key; if (key) reload(key); };
async function reload(key){ let rec = null; try { rec = await req('readonly', st => st.get(key)); } catch(_){} await setImg(key, rec); emit(key); }
async function loadAll(){
  try {
    const db = await openDb();
    const recs = await new Promise((res, rej) => { const out = {}, cur = db.transaction(STORE).objectStore(STORE).openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c){ out[c.key] = c.value; c.continue(); } else res(out); }; cur.onerror = () => rej(cur.error); });
    await Promise.all(Object.entries(recs).map(([k, r]) => setImg(k, r)));
  } catch(_){}
  ready = true; emit(null);
}
/* 올린 파일: 투명 여백을 잘라내고 긴 변 512px 이하 PNG로 맞춘다 */
function normalize(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const nw = im.naturalWidth || 512, nh = im.naturalHeight || 512, s0 = Math.min(1, 1024 / Math.max(nw, nh));
      const W = Math.max(1, Math.round(nw*s0)), H = Math.max(1, Math.round(nh*s0));
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      try { const d = g.getImageData(0, 0, W, H).data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y*W + x)*4 + 3] > 8){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      } catch(_){ x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
      if (x1 < 0){ rej(new Error('empty')); return; }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, 512 / Math.max(cw, ch));
      const w = Math.max(1, Math.round(cw*s)), h = Math.max(1, Math.round(ch*s));
      const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, w, h);
      o.toBlob(b => b ? res({ blob:b, w, h }) : rej(new Error('encode')), 'image/png');
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    im.src = url;
  });
}
async function put(key, file){
  const n = await normalize(file);
  const rec = { blob:n.blob, w:n.w, h:n.h, name:file.name || '', t:Date.now() };
  await req('readwrite', st => st.put(rec, key)); await setImg(key, rec); emit(key); if (bc) bc.postMessage({ key });
}
async function useOld(key){ const rec = { off:true, t:Date.now() }; await req('readwrite', st => st.put(rec, key)); await setImg(key, rec); emit(key); if (bc) bc.postMessage({ key }); }
async function remove(key){ await req('readwrite', st => st.delete(key)); await setImg(key, null); emit(key); if (bc) bc.postMessage({ key }); }
async function removeAll(){ const keys = Object.keys(META); await req('readwrite', st => st.clear()); for (const k of keys){ await setImg(k, null); if (bc) bc.postMessage({ key:k }); } emit(null); }

/* ---------- 교체할 수 있는 그림 목록 (box = 게임 속 최대 크기, 월드 단위) ---------- */
const CAT_KIND = t => CATS[t].boss ? '보스' : CATS[t].elite ? '엘리트' : '일반';
const CATALOG = [
  { group:'char', key:'player', name:'학생 (플레이어)', hint:'왼쪽을 보는 전신. 교체하면 꾸미기 옷·머리는 그려지지 않는다.', box:[40, 50] },
  ...Object.keys(CATS).map(t => ({ group:'cat', key:'cat:' + t, type:t, name:CATS[t].name, hint:`${CAT_KIND(t)} · 왼쪽을 보는 모습`, box:[Math.round(CATS[t].r*3), Math.round(CATS[t].r*2.6)] })),
  { group:'walk', key:'walk:player', name:'학생 걷기', hint:'걸을 때 기본 그림과 번갈아 나온다. 기본 그림과 같은 크기·자리·방향으로', box:[40, 50] },
  ...Object.keys(CATS).map(t => ({ group:'walk', key:'walk:' + t, type:t, name:CATS[t].name + ' 걷기', hint:'걸을 때 기본 그림과 번갈아 나온다. 기본 그림과 같은 크기·자리·방향으로', box:[Math.round(CATS[t].r*3), Math.round(CATS[t].r*2.6)] })),
  ...[['heart','하트 (경험치)','작은·중간·큰 하트 모두 이 그림을 크기만 바꿔 쓴다', 24], ['coin','용돈','', 18], ['food','삼각김밥','', 24], ['vacuum','진공청소기','', 28], ['cucumber','오이','', 28], ['spray','분무기','', 24], ['chest','택배상자','반짝이는 테두리는 그대로 그린다', 40]]
    .map(([k, name, hint, b]) => ({ group:'pick', key:'pick:' + k, type:k, name, hint, box:[b, b] })),
  ...[[WEAPONS,'기본 무기'], [PASSIVES,'패시브'], [EVOS,'진화'], [UPPERS,'상위 진화']].flatMap(([set, kind]) =>
    Object.keys(set).map(id => ({ group:'icon', key:'icon:' + id, id, name:set[id].name, hint:kind + ' 아이콘 · HUD, 레벨업, 도감', box:[30, 30] }))),
  ...[['churu','츄르 방울','츄르 · 날아가는 방향으로 돌아간다', 24], ['cannon','참치맛 츄르 덩어리','츄르 대포 · 날아가는 방향으로 돌아간다', 52],
      ['laser','레이저 점','레이저 포인터 · 빛 번짐까지 포함한 크기', 29], ['rainbow','무지개 레이저 점','미러볼 레이저쇼, 냥냥 디스코 파티', 34],
      ['yarn','털실뭉치','털실뭉치 · 날며 빙글빙글 돈다', 24], ['spiral','회오리 털실','털실 폭풍 · 빙글빙글 돈다', 40],
      ['mouse','태엽 쥐돌이','태엽 쥐돌이 · 오른쪽이 머리, 공전 방향을 본다', 34], ['goldmouse','황금 쥐돌이','무한태엽 쥐돌이, 털실 쥐돌이 군단', 34],
      ['bubble','비눗방울','비눗방울 건', 22], ['black','블랙홀 방울','블랙홀 비눗방울, 디스코 파티 · 천천히 돈다. 빨아들이는 테두리는 그대로', 53]]
    .map(([k, name, hint, b]) => ({ group:'proj', key:'proj:' + k, type:k, name, hint, box:[b, b] })),
  ...[['feather','깃털 휘두르기','깃털 낚싯대 · 오른쪽으로 뻗은 깃털. 분홍 잔상은 그대로', [112, 28]], ['pinwheel','바람개비 깃털 날개','바람개비 깃털 · 오른쪽으로 뻗은 날개 한 장', [111, 32]],
      ['tornado','회오리 날개','츄르 회오리 · 오른쪽으로 뻗은 날개 한 장', [126, 32]], ['mirrorball','미러볼','미러볼 레이저쇼, 디스코 파티 · 머리 위에 뜬다', [26, 26]]]
    .map(([k, name, hint, box]) => ({ group:'proj', key:'wep:' + k, type:k, name, hint, box })),
  ...[['leaf','캣닢 잎','캣닢 장판에서 흩날리는 파티클 · 가장 많이 나온다'], ['petal','캣닢 꽃','캣닢 장판 파티클'], ['sparkle','반짝이','캣닢 장판 파티클 · 반짝이며 커졌다 작아진다']]
    .map(([k, name, hint]) => ({ group:'part', key:'part:' + k, type:k, name, hint, box:[12, 12] })),
  ...[['zone:puddle','츄르 웅덩이','츄르 대포, 츄르 회오리 · 납작한 타원 자리', 76],
      ['aura:matatabi','마따따비 향기 오라','마따따비 향주머니 · 오라 원 크기에 맞춰 늘고 천천히 돈다', 144], ['aura:forest','마따따비 숲','오라 원 크기에 맞춰 늘고 천천히 돈다', 460],
      ['aura:flowerfield','캣닢 꽃밭','점점 커지는 원에 맞춰 늘어난다', 400], ['aura:paradise','고양이 낙원','오라 원 크기에 맞춰 늘고 천천히 돈다', 540],
      ['fx:ring','터지는 효과','방울 폭발, 담벼락 착지, 화분 깨짐 · 커지며 사라진다', 92]]
    .map(([key, name, hint, b]) => ({ group:'fx', key, name, hint, box:[b, b] })),
];
/* 게임에 들어 있는 생성 그림 (tools/bake_sprites.py 가 이 줄을 고친다) */
const BUNDLED_V = {"player":"1f765d38","cat:baby":"edd9af00","cat:stray":"87ee12d1","cat:dash":"37eba7bc","cat:fat":"6098c263","cat:black":"b27cdc82","cat:wall":"78a976a1","cat:elite":"f3bc5c82","cat:cheese":"7540e1bb","cat:sam":"693758fa","cat:tux":"67143b0b","cat:king":"798cd610","walk:player":"f148a675","walk:baby":"3af5e21a","walk:stray":"42936bbd","walk:dash":"b7f06eb4","walk:fat":"26cd4491","walk:black":"1ee7c5a8","walk:wall":"da056ee4","walk:elite":"5dc99a1f","walk:cheese":"948072e7","walk:sam":"16cb85d1","walk:tux":"b508eafc","walk:king":"d2d4b1d3","pick:heart":"d80ba054","pick:coin":"36c99cbf","pick:food":"206f9aa2","pick:vacuum":"a16b3288","pick:cucumber":"0a839b59","pick:spray":"ee700c35","pick:chest":"e8e93f33","icon:churu":"9a20c6ec","icon:feather":"4981a407","icon:laser":"fcc0a198","icon:catnip":"e2c8adeb","icon:yarn":"eaf977c3","icon:mouse":"d8d9f83d","icon:matatabi":"f538e9ce","icon:bubble":"e1732052","icon:lunch":"dfe518bf","icon:shoes":"a9eee6cc","icon:battery":"9e6afc5d","icon:ears":"01742df4","icon:refill":"b1bdce1b","icon:clock":"a52df49d","icon:milk":"bd6f55e6","icon:magnet":"ab946210","icon:cannon":"5527aba6","icon:pinwheel":"506afe03","icon:mirrorball":"bd0c7a5a","icon:flowerfield":"97f8a5aa","icon:yarnstorm":"09d8181f","icon:infmouse":"d09d1dcf","icon:forest":"e8cc1866","icon:blackhole":"38cbec61","icon:disco":"8735bb27","icon:paradise":"9353d017","icon:legion":"9e9d1eda","icon:tornado":"2f0baed5","proj:churu":"be73111b","proj:cannon":"a4e12b8b","proj:laser":"22924a3d","proj:rainbow":"e441527a","proj:yarn":"e01c85fe","proj:spiral":"5fa027bc","proj:mouse":"68818764","proj:goldmouse":"2fb4ac2f","proj:bubble":"b114d53c","proj:black":"25060612","wep:feather":"f3cabc1a","wep:pinwheel":"faa5e5f9","wep:tornado":"28f2d510","wep:mirrorball":"4f23c307","part:leaf":"f17bb4ab","part:petal":"31150c40","part:sparkle":"f40e19b9","zone:puddle":"5d94c1d4","aura:matatabi":"2aa76f3a","aura:forest":"80f7f30d","aura:flowerfield":"26a6a037","aura:paradise":"7c935e17","fx:ring":"ac33383b"};   // 그림마다 내용 해시: 그림이 바뀌면 주소가 바뀌어 브라우저가 새로 받는다
const BUNDLED = Object.keys(BUNDLED_V);
/* 파일 이름: 학생·고양이는 걷기 1/2 (player_walk_1.png, cat_baby_walk_2.png), 나머지는 키 그대로 (pick_coin.png) */
const fileOf = key => key === 'player' ? 'player_walk_1.png' : key === 'walk:player' ? 'player_walk_2.png'
  : key.startsWith('cat:') ? 'cat_' + key.slice(4) + '_walk_1.png' : key.startsWith('walk:') ? 'cat_' + key.slice(5) + '_walk_2.png'
  : key.replace(':', '_') + '.png';
const baseUrl = key => 'sprites/' + fileOf(key) + (BUNDLED_V[key] ? '?v=' + BUNDLED_V[key] : '');
for (const key of BUNDLED){ const im = new Image(); im.onload = () => { BASE[key] = im; pickImg(key); emit(key); }; im.src = baseUrl(key); }
const GROUPS = { char:'캐릭터', cat:'고양이', walk:'걷기 프레임', pick:'필드 아이템', icon:'무기·패시브 아이콘', proj:'무기 투사체', fx:'장판·오라·효과', part:'파티클' };

/* ---------- 관리자 미리보기 (W×W 칸) ---------- */
function preview(g, it, W, look){
  use(g); g.clearRect(0, 0, W, W); g.save();
  const c = W/2, P = { x:c, y:c, weapons:[] };
  if (it.group === 'char'){ const sc = W/60; g.translate(c, c + 8*sc); g.scale(sc, sc); drawStudent(look, -1, 0, 0); }
  else if (it.group === 'cat'){ const sc = W/96, r = CATS[it.type].r; g.scale(sc, sc); drawCatBody(it.type, c/sc, (W - W/10)/sc - r*.95, r, -1, 0, {}); }
  else if (it.group === 'walk'){ const wim = IMG[it.key], bim = IMG[it.type ? 'cat:' + it.type : 'player'], im = wim || bim;
    if (im){ g.globalAlpha = wim ? 1 : .35; const s = Math.min((W - 16) / (im.naturalWidth || im.width), (W - 16) / (im.naturalHeight || im.height)); const w = (im.naturalWidth || im.width) * s, h = (im.naturalHeight || im.height) * s; g.drawImage(im, (W - w)/2, (W - h)/2, w, h); } }
  else if (it.group === 'pick'){ const sc = W/50; g.scale(sc, sc); drawPick({ type:it.type, x:c/sc, y:c/sc, v:20 }, -c/sc/4); }
  else if (it.key.startsWith('proj:')){
    const t = it.type, base = { kind:t, x:c, y:c, vx:1, vy:0, spin:.6, hs:new Set(), r:10 };
    if (t === 'mouse' || t === 'goldmouse'){ g.translate(c, c); g.scale(W/56, W/56); drawMouse(0, 0, -Math.PI/2, t === 'goldmouse'); }
    else { const o = { ...base,
        ...(t === 'cannon' ? { r:16 } : t === 'laser' ? { r:7 } : t === 'rainbow' ? { kind:'laser', rainbow:true, r:8 } : t === 'yarn' ? { r:11 } : t === 'spiral' ? { r:18 } : t === 'black' ? { r:24, pullR:40 } : {}) };
      const sc = W / Math.max(60, it.box[0] * 1.5); g.translate(c, c); g.scale(sc, sc); g.translate(-c, -c); drawProj(o, 0); }
  }
  else if (it.key.startsWith('wep:')){
    if (it.type === 'feather'){ const sc = W/130; g.translate(W*.06, c); g.scale(sc, sc); drawSweep({ ang:0, len:112, wid:54, life:.11, max:.22 }, { x:0, y:0 }); }
    else if (it.type === 'mirrorball'){ const sc = W/40; g.translate(c, c); g.scale(sc, sc); drawWeaponFront({ x:0, y:46, weapons:[{ id:'mirrorball' }] }); }
    else { const len = it.box[0] + 14, sc = W/(len + 16); g.translate(W*.04, c); g.scale(sc, sc); drawWeaponFront({ x:0, y:0, weapons:[{ id:it.type, len, nb:1, ang:0 }] }); }
  }
  else if (it.group === 'part'){ const im = IMG[it.key]; if (im){ const s = Math.min((W*.6) / (im.naturalWidth || im.width), (W*.6) / (im.naturalHeight || im.height)), w = (im.naturalWidth || im.width) * s, h = (im.naturalHeight || im.height) * s; g.drawImage(im, (W - w)/2, (W - h)/2, w, h); } else { g.fillStyle = it.type === 'petal' ? '#f6b6cf' : it.type === 'sparkle' ? '#f3f7a8' : '#5aa64f'; g.beginPath(); g.ellipse(W/2, W/2, W*.25, W*.15, 0, 0, TAU); g.fill(); } }
  else if (it.key.startsWith('zone:')){ const sc = W/100; g.scale(sc, sc); drawZone({ kind:it.key.slice(5), x:50, y:50, r:40, life:1 }); }
  else if (it.key.startsWith('aura:')){ const sc = W/110; g.scale(sc, sc); P.x = P.y = 55; P.weapons = [{ id:it.key.slice(5), R:48 }]; drawWeaponAuras(P, 0); }
  else if (it.key === 'fx:ring'){ const sc = W/100; g.scale(sc, sc); drawFx({ k:'ring', x:50, y:50, r:46, t:.25, dur:.35, col:'rgba(120,200,255,.9)' }); }
  g.restore();
}

/* ---------- 기본 그림 ---------- */
function ell(x, y, rx, ry){ ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }
function drawCatBody(type, x, y, r, fx, anim, opts={}){
  const T = CATS[type], base = IMG['cat:' + type];
  if (base){
    // 걷기: 기본 그림과 걷기 그림을 번갈아 그린다 (걷기 그림이 없으면 기본 그림만)
    const walk = IMG['walk:' + type], im = walk && Math.sin(anim) < 0 ? walk : base;
    // 고양이 그림은 왼쪽을 보게 그려 둔다. fx(+1 = 오른쪽으로 이동)에 맞춰 뒤집는다
    ctx.save(); ctx.translate(x, y - (opts.hop || 0)); ctx.scale(-fx, 1);
    fitDraw(tinted(im, opts.flash ? 'flash' : opts.freeze ? 'freeze' : null), 0, r*.95, r*3, r*2.6);
    ctx.restore(); return;
  }
  ctx.save(); ctx.translate(x, y - (opts.hop || 0));
  ctx.scale(fx, 1);
  const bob = Math.sin(anim) * r * .07, outline = T.light ? '#e9e4f5' : '#1f2a44', body = opts.flash ? '#ffffff' : opts.freeze ? '#bfe3f7' : T.col;
  ctx.lineWidth = Math.max(1.6, r*.11); ctx.strokeStyle = outline; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r*.8, r*.15); ctx.quadraticCurveTo(-r*1.55, -r*.1 + Math.sin(anim*.5)*r*.35, -r*1.15, -r*.85); ctx.lineWidth = r*.36; ctx.stroke(); ctx.lineWidth = r*.2; ctx.strokeStyle = body; ctx.stroke();
  ctx.lineWidth = Math.max(1.6, r*.11); ctx.strokeStyle = outline;
  ctx.fillStyle = body; ell(-r*.08, r*.25 + bob, r*.95, r*.6); ctx.fill(); ctx.stroke();
  if (T.stripes && !opts.flash){ ctx.strokeStyle = T.stripes; ctx.lineWidth = r*.14; ctx.beginPath(); for (let k = -1; k <= 1; k++){ ctx.moveTo(-r*.1 + k*r*.38, -r*.15 + bob); ctx.lineTo(-r*.2 + k*r*.38, r*.55 + bob); } ctx.stroke(); ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1.6, r*.11); }
  if (T.patch && !opts.flash){ ctx.fillStyle = T.patch; ell(-r*.45, r*.1 + bob, r*.3, r*.22); ctx.fill(); }
  if (T.calico && !opts.flash){ ctx.fillStyle = '#e08a3a'; ell(-r*.4, r*.12 + bob, r*.32, r*.25); ctx.fill(); ctx.fillStyle = '#2b2b30'; ell(r*.05, r*.42 + bob, r*.28, r*.18); ctx.fill(); }
  if (T.tux && !opts.flash){ ctx.fillStyle = '#f4f1ea'; ell(r*.35, r*.35 + bob, r*.3, r*.3); ctx.fill(); }
  const hx = r*.58, hy = -r*.22 + bob, hr = r*.56;
  ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(hx - hr*.85, hy - hr*.35); ctx.lineTo(hx - hr*.55, hy - hr*1.35); ctx.lineTo(hx - hr*.05, hy - hr*.75); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + hr*.85, hy - hr*.35); ctx.lineTo(hx + hr*.55, hy - hr*1.35); ctx.lineTo(hx + hr*.05, hy - hr*.75); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(hx, hy, hr, hr*.88); ctx.fill(); ctx.stroke();
  if (T.calico && !opts.flash){ ctx.fillStyle = '#e08a3a'; ell(hx - hr*.45, hy - hr*.35, hr*.38, hr*.32); ctx.fill(); }
  if (T.tux && !opts.flash){ ctx.fillStyle = '#f4f1ea'; ell(hx + hr*.1, hy + hr*.38, hr*.5, hr*.32); ctx.fill(); }
  const eye = T.light ? '#f6f2ff' : '#1f2a44';
  ctx.strokeStyle = eye; ctx.fillStyle = eye; ctx.lineWidth = Math.max(1.4, r*.09);
  if (opts.happy || opts.purr){
    ctx.beginPath(); ctx.arc(hx - hr*.32, hy + (opts.purr ? 0 : hr*.08), hr*.18, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx + hr*.32, hy + (opts.purr ? 0 : hr*.08), hr*.18, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
  } else { ell(hx - hr*.3, hy - hr*.05, hr*.11, hr*.15); ctx.fill(); ell(hx + hr*.3, hy - hr*.05, hr*.11, hr*.15); ctx.fill(); }
  ctx.fillStyle = '#f08aa0'; ell(hx, hy + hr*.22, hr*.1, hr*.07); ctx.fill();
  if (opts.box){ const bw = hr*1.5, bh = hr*.9, by = hy - hr*1.05; ctx.fillStyle = '#c89b62'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = Math.max(1.6, r*.09);
    ctx.fillRect(hx - bw/2, by - bh, bw, bh); ctx.strokeRect(hx - bw/2, by - bh, bw, bh); ctx.fillStyle = '#e8d3a8'; ctx.fillRect(hx - bw*.1, by - bh, bw*.2, bh); }
  if (T.crown){ ctx.fillStyle = '#ffc93c'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ctx.beginPath(); const cw = hr*.9, cy0 = hy - hr*.95;
    ctx.moveTo(hx - cw/2, cy0); ctx.lineTo(hx - cw/2, cy0 - hr*.45); ctx.lineTo(hx - cw/4, cy0 - hr*.2); ctx.lineTo(hx, cy0 - hr*.55); ctx.lineTo(hx + cw/4, cy0 - hr*.2); ctx.lineTo(hx + cw/2, cy0 - hr*.45); ctx.lineTo(hx + cw/2, cy0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function drawHeart(x, y, s, col){
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s*.9);
  ctx.bezierCurveTo(x - s*1.4, y, x - s*.8, y - s*1.1, x, y - s*.35); ctx.bezierCurveTo(x + s*.8, y - s*1.1, x + s*1.4, y, x, y + s*.9); ctx.fill();
}
function drawPick(k, now){
  const bob = Math.sin(now*4 + k.x) * 2, im = IMG['pick:' + k.type];
  if (im){
    const box = k.type === 'heart' ? (k.v >= 20 ? 24 : k.v >= 3 ? 18 : 13) : PICK_BOX[k.type] || 24;
    fitDraw(im, k.x, k.y + bob + box/2, box, box); return;
  }
  switch (k.type){
    case 'heart': { const s = k.v >= 20 ? 10 : k.v >= 3 ? 7.5 : 5.5; drawHeart(k.x, k.y + bob, s, k.v >= 20 ? '#ff3d6e' : k.v >= 3 ? '#ff5c86' : '#ff8fab'); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(k.x - s*.35, k.y - s*.25 + bob, s*.25, Math.PI, Math.PI*1.6); ctx.stroke(); break; }
    case 'coin': ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#a77a00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#a77a00'; ctx.font = '10px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('용', k.x, k.y + bob + 1); break;
    case 'food': ctx.fillStyle = '#fbf8f1'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(k.x, k.y - 11 + bob); ctx.lineTo(k.x + 11, k.y + 8 + bob); ctx.lineTo(k.x - 11, k.y + 8 + bob); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#26402f'; ctx.fillRect(k.x - 5, k.y + bob, 10, 8); break;
    case 'vacuum': ctx.fillStyle = '#4c8fd6'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ell(k.x, k.y + bob, 11, 8); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k.x + 8, k.y - 4 + bob); ctx.lineTo(k.x + 15, k.y - 14 + bob); ctx.stroke(); break;
    case 'cucumber': ctx.fillStyle = '#5aa64f'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ctx.save(); ctx.translate(k.x, k.y + bob); ctx.rotate(-.5); ell(0, 0, 13, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8fd07f'; ell(-3, -1, 6, 2); ctx.fill(); ctx.restore(); break;
    case 'spray': ctx.fillStyle = '#7cc6ec'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ctx.fillRect(k.x - 6, k.y - 4 + bob, 12, 14); ctx.strokeRect(k.x - 6, k.y - 4 + bob, 12, 14); ctx.fillStyle = '#1f2a44'; ctx.fillRect(k.x - 3, k.y - 11 + bob, 9, 6); break;
    case 'chest': { const y = k.y + bob; ctx.fillStyle = '#c89b62'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2.5; ctx.fillRect(k.x - 17, y - 12, 34, 24); ctx.strokeRect(k.x - 17, y - 12, 34, 24);
      ctx.fillStyle = '#e8d3a8'; ctx.fillRect(k.x - 4, y - 12, 8, 24); ctx.fillStyle = '#1f2a44'; ctx.font = '10px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('택배', k.x, y + 2);
      break; }
  }
}
const FUR_SPOTS = [[-4,-4],[5,2],[-1,6],[6,-6],[-6,3],[2,-2],[-3,10],[4,12],[-12,-2],[7,7],[-5,-8],[0,3],[-10,5],[3,-7]];
function rr(x, y, w, h, r){ ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
/* the student, facing +x, origin at the feet line; look = SAVE.look */
function drawStudent(L, faceX, step, fur, tint){
  const base = IMG.player;
  if (base){ const walk = IMG['walk:player'], im = walk && step > 0 ? walk : base;
    // 학생 그림도 왼쪽을 보게 그려 둔다. faceX(+1 = 오른쪽)에 맞춰 뒤집는다
    ctx.save(); ctx.scale(-faceX, 1); fitDraw(tinted(im, tint), 0, 17, 40, 50); ctx.restore(); return; }
  const INK = '#1f2a44', skin = SKINS[L.skin] || SKINS[0], hair = HAIR_COLORS[L.hairColor] || HAIR_COLORS[0];
  ctx.save(); ctx.scale(faceX, 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // behind: ponytail, hood, back bags
  if (L.hair === 'pony'){ ctx.fillStyle = hair; ctx.save(); ctx.translate(-10, -16); ctx.rotate(.5 + Math.sin(step*2)*.15); ell(0, 0, 6, 3.4); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (L.top === 'hoodie'){ ctx.fillStyle = '#d97796'; ell(-4, -11, 8, 6); ctx.fill(); ctx.stroke(); }
  if (L.bag === 'bookbag'){ ctx.fillStyle = '#ffc93c'; rr(-16, -9, 10, 17, 4); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#c99a1e'; ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(-7, -2); ctx.stroke(); ctx.strokeStyle = INK; }
  if (L.bag === 'catpack'){ ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(-18, -9); ctx.lineTo(-16, -15); ctx.lineTo(-12, -10); ctx.lineTo(-8, -15); ctx.lineTo(-6, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ell(-12, -1, 7.5, 8.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-14.5, -2, 1, 0, TAU); ctx.arc(-9.5, -2, 1, 0, TAU); ctx.fill(); ctx.fillStyle = '#f08aa0'; ell(-12, 1, 1.4, 1); ctx.fill(); }
  const bagX = L.bag === 'churubag' ? 6 : -12, bagY = L.bag === 'churubag' ? 7 : 9;
  // legs & bottoms
  const s = step * 1.5;
  if (L.bottom === 'skirt'){ ctx.fillStyle = skin; ctx.fillRect(-5, 7 + s, 4, 9 - s); ctx.fillRect(1, 7 - s, 4, 9 + s);
    ctx.fillStyle = '#2f3b5e'; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(9, 4); ctx.lineTo(11, 11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else { const col = L.bottom === 'pants' ? '#2f3b5e' : '#3f8f5a'; ctx.fillStyle = col; ctx.fillRect(-6, 6 + s, 5, 10 - s); ctx.fillRect(1, 6 - s, 5, 10 + s);
    if (L.bottom === 'trackpants'){ ctx.fillStyle = '#fff'; ctx.fillRect(-4, 7 + s, 1, 8 - s); ctx.fillRect(3, 7 - s, 1, 8 + s); } }
  // shoes
  const shoe = L.shoes === 'boots' ? '#ffc93c' : L.shoes === 'pawshoes' ? '#f4a3b8' : '#f4f4f0';
  const sh = L.shoes === 'boots' ? 6 : 3;
  ctx.fillStyle = shoe; rr(-7, 17 - sh, 7, sh, 1.5); ctx.fill(); ctx.stroke(); rr(1, 17 - sh, 7, sh, 1.5); ctx.fill(); ctx.stroke();
  if (L.shoes === 'slipper'){ ctx.fillStyle = '#4c8fd6'; ctx.fillRect(-6, 14.5, 5, 1.2); ctx.fillRect(2, 14.5, 5, 1.2); }
  if (L.shoes === 'pawshoes'){ ctx.fillStyle = '#d6455d'; ctx.beginPath(); ctx.arc(-2, 15.5, .9, 0, TAU); ctx.arc(6, 15.5, .9, 0, TAU); ctx.fill(); }
  // top
  const topCol = { shirt:'#f4f4f0', track:'#3f8f5a', hoodie:'#e48aa8', catsweat:'#efe2c8' }[L.top] || '#f4f4f0';
  ctx.fillStyle = topCol; rr(-8, -9, 17, L.bottom === 'skirt' ? 15 : 17, 5); ctx.fill(); ctx.stroke();
  if (L.top === 'shirt'){ ctx.fillStyle = '#d6455d'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, -8); ctx.lineTo(2, 1); ctx.closePath(); ctx.fill(); }
  if (L.top === 'track'){ ctx.fillStyle = '#fff'; ctx.fillRect(1, -8, 1.5, 14); }
  if (L.top === 'hoodie'){ ctx.strokeStyle = 'rgba(31,42,68,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(6, 2); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 2; }
  if (L.top === 'catsweat'){ ctx.fillStyle = '#e6a54c'; ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(0, -6); ctx.lineTo(2, -4); ctx.lineTo(4, -6); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill(); ell(2, -1, 3.6, 3); ctx.fill(); }
  // fur stuck on clothes (resets every run)
  if (fur > 0){ ctx.strokeStyle = 'rgba(250,246,236,.95)'; ctx.lineWidth = 1.2; for (let i = 0; i < Math.floor(fur); i++){ const [fx, fy] = FUR_SPOTS[i]; ctx.beginPath(); ctx.moveTo(fx - 1.6, fy); ctx.quadraticCurveTo(fx, fy - 2, fx + 1.6, fy); ctx.stroke(); } ctx.strokeStyle = INK; ctx.lineWidth = 2; }
  // crossbody churu bag sits in front
  if (L.bag === 'churubag'){ ctx.strokeStyle = '#8a4a12'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(5, 4); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(6, 6); ctx.rotate(-.5); ctx.fillStyle = '#f39a3d'; rr(-7, -3, 14, 6, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 4, 4); ctx.restore(); }
  // accessories
  if (L.acc === 'scarf'){ ctx.fillStyle = '#d6455d'; rr(-7, -11, 15, 4, 2); ctx.fill(); ctx.stroke(); rr(-7, -9, 4, 9, 2); ctx.fill(); ctx.stroke(); }
  if (L.acc === 'doll'){ ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bagX, bagY - 3); ctx.lineTo(bagX, bagY); ctx.stroke(); ctx.lineWidth = 1.5;
    ctx.fillStyle = '#f2c49a'; ctx.beginPath(); ctx.arc(bagX, bagY + 3, 3.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bagX - 3, bagY + 1); ctx.lineTo(bagX - 2, bagY - 1.5); ctx.lineTo(bagX, bagY + .5); ctx.lineTo(bagX + 2, bagY - 1.5); ctx.lineTo(bagX + 3, bagY + 1); ctx.fill(); ctx.lineWidth = 2; }
  if (L.acc === 'bell'){ ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(bagX, bagY + 2, 2.6, 0, TAU); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 2; }
  // head
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(1, -17, 9, 0, TAU); ctx.fill(); ctx.stroke();
  // hair
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, -19, 9.3, Math.PI*.95, Math.PI*2.05); ctx.fill();
  if (L.hair === 'bob'){ rr(-9, -21, 7, 12, 3); ctx.fill(); }
  if (L.hair === 'pony'){ ctx.fillStyle = '#d6455d'; ctx.fillRect(-9, -18, 2.5, 3); }
  if (L.hair === 'messy'){ ctx.beginPath(); ctx.moveTo(-6, -25); ctx.lineTo(-4, -30); ctx.lineTo(-1, -26); ctx.lineTo(1, -31); ctx.lineTo(3, -26); ctx.lineTo(6, -29); ctx.lineTo(6, -24); ctx.closePath(); ctx.fill(); }
  // face
  ctx.fillStyle = INK; ctx.strokeStyle = INK;
  if (L.eyes === 'smile'){ ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(5, -15.5, 1.6, Math.PI*1.1, Math.PI*1.9); ctx.stroke(); }
  else if (L.eyes === 'sparkle'){ ctx.beginPath(); ctx.arc(5, -16, 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5.6, -16.7, .8, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(5, -16, 1.4, 0, TAU); ctx.fill(); }
  if (L.blush){ ctx.fillStyle = 'rgba(240,120,140,.6)'; ell(5, -12.5, 2.2, 1.2); ctx.fill(); }
  if (L.glasses){ ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(5, -16, 3, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, -16.5); ctx.lineTo(-3, -17.5); ctx.stroke(); }
  ctx.lineWidth = 2;
  // hats
  if (L.hat === 'beanie'){ ctx.fillStyle = '#7d8796'; ctx.beginPath(); ctx.arc(1, -19, 9.8, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -25); ctx.lineTo(-5, -32); ctx.lineTo(-1, -27); ctx.closePath(); ctx.moveTo(3, -27); ctx.lineTo(7, -32); ctx.lineTo(8, -25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5e6878'; rr(-9, -21, 20, 3.4, 1.5); ctx.fill(); }
  if (L.hat === 'yellowcap'){ ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(1, -20, 9.6, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke(); ell(9, -20, 6, 2); ctx.fill(); ctx.stroke(); }
  if (L.hat === 'fishpin'){ ctx.save(); ctx.translate(-2, -25); ctx.rotate(-.3); ctx.fillStyle = '#5aa7d6'; ell(0, 0, 4.2, 2.2); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(-6.5, -2.4); ctx.lineTo(-6.5, 2.4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(2, -.4, .6, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.restore();
}

/* ---------- 무기 투사체·장판·효과 ---------- */
function hash(i, j){ let h = (i*374761393 + j*668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
/* (x, y) 가운데 기준으로 bw×bh 상자 안에 비율을 지켜 그린다 */
function fitC(im, x, y, bw, bh){ const s = Math.min(bw / im.naturalWidth, bh / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s; ctx.drawImage(im, x - w/2, y - h/2, w, h); }
function spin(im, x, y, a, bw, bh){ ctx.save(); ctx.translate(x, y); ctx.rotate(a); fitC(im, 0, 0, bw, bh); ctx.restore(); }
function projImg(p){ const key = p.kind === 'laser' ? (p.rainbow ? 'proj:rainbow' : 'proj:laser') : 'proj:' + p.kind; return IMG[key] || null; }
function drawProjImg(p, im){
  const a = Math.atan2(p.vy || 0, p.vx || 1);
  if (p.kind === 'churu') spin(im, p.x, p.y, a, 24, 24);
  else if (p.kind === 'cannon') spin(im, p.x, p.y, a, 52, 52);
  else if (p.kind === 'laser') fitC(im, p.x, p.y, p.r*4.2, p.r*4.2);
  else if (p.kind === 'yarn' || p.kind === 'spiral') spin(im, p.x, p.y, p.spin || 0, p.r*2.2, p.r*2.2);
  else fitC(im, p.x, p.y, p.r*2.2, p.r*2.2);
}
function drawMouse(x, y, ang, gold){
  const im = IMG[gold ? 'proj:goldmouse' : 'proj:mouse']; if (im){ spin(im, x, y, ang + Math.PI/2, 34, 34); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI/2);
  ctx.fillStyle = gold ? '#d8c27a' : '#a9b0bc'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ell(0, 0, 11, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2a0b0'; ctx.beginPath(); ctx.arc(7, -5, 3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(7, 5, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1f2a44'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-17, 6, -21, 0); ctx.stroke();
  ctx.fillStyle = '#ffc93c'; ctx.fillRect(-3, -2, 6, 4);
  ctx.restore();
}
function drawWeaponAuras(P, now){
  for (const w of P.weapons){
    const aim = w.R && IMG['aura:' + w.id];
    if (aim){ ctx.save(); ctx.globalAlpha = .5; spin(aim, P.x, P.y, now*.2, w.R*2, w.R*2); ctx.restore(); continue; }
    if (w.id === 'matatabi' && w.R){ ctx.fillStyle = 'rgba(80,190,150,.13)'; ctx.strokeStyle = `rgba(63,155,138,${.35 + Math.sin(now*5)*.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, w.R, 0, TAU); ctx.fill(); ctx.stroke(); }
    if ((w.id === 'forest' || w.id === 'flowerfield' || w.id === 'paradise') && w.R){
      const col = w.id === 'forest' ? 'rgba(47,138,118,' : w.id === 'flowerfield' ? 'rgba(110,190,90,' : 'rgba(255,200,90,';
      ctx.fillStyle = col + '.14)'; ctx.strokeStyle = col + '.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y, w.R, 0, TAU); ctx.fill(); ctx.stroke();
      const n = w.id === 'paradise' ? 28 : 16;
      for (let k = 0; k < n; k++){ const a = k/n*TAU + now*.2, rr = w.R * (.35 + .55*hash(k, 3));
        const x = P.x + Math.cos(a)*rr, y = P.y + Math.sin(a)*rr;
        if (w.id === 'forest'){ ctx.fillStyle = 'rgba(70,150,90,.55)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }
        else { ctx.fillStyle = k % 2 ? 'rgba(255,240,140,.85)' : 'rgba(255,170,200,.85)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); } }
    }
  }
}
function drawWeaponFront(P){
  for (const w of P.weapons){
    if ((w.id === 'pinwheel' || w.id === 'tornado') && w.len){
      for (let b = 0; b < w.nb; b++){ const a = w.ang + b*TAU/w.nb; ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(a);
        const bim = IMG['wep:' + w.id]; if (bim){ fitC(bim, (14 + w.len)/2, 0, w.len - 14, 32); ctx.restore(); continue; }
        ctx.fillStyle = w.id === 'tornado' ? 'rgba(240,130,60,.85)' : 'rgba(230,100,160,.85)'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(w.len*.55, -18, w.len, 0); ctx.quadraticCurveTo(w.len*.55, 10, 14, 0); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
    if (w.id === 'mirrorball' || w.id === 'disco'){ const x = P.x, y = P.y - 46; const mim = IMG['wep:mirrorball']; if (mim){ fitC(mim, x, y - 4, 26, 26); continue; } ctx.fillStyle = '#c9d2e0'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(31,42,68,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke(); ctx.strokeStyle = '#1f2a44'; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 18); ctx.stroke(); }
  }
}
function drawSweep(s, P){ const k = 1 - s.life/s.max; ctx.save(); ctx.translate(P.x, P.y + (s.oy || 0)); ctx.rotate(s.ang); ctx.globalAlpha = 1 - k*.7;
    ctx.fillStyle = 'rgba(230,106,166,.35)'; ctx.beginPath(); ctx.moveTo(8, -s.wid/2); ctx.quadraticCurveTo(s.len*1.05, -s.wid*.6, s.len, 0); ctx.quadraticCurveTo(s.len*1.05, s.wid*.6, 8, s.wid/2); ctx.closePath(); ctx.fill();
    const fy = -s.wid/2 + s.wid*k, fim = IMG['wep:feather'];
    if (fim){ const L = Math.hypot(s.len*.95 - 10, fy - fy*.3); ctx.translate(10, fy*.3); ctx.rotate(Math.atan2(fy - fy*.3, s.len*.95 - 10)); fitC(fim, L/2, 0, L, 28); }
    else { ctx.strokeStyle = '#e46aa6'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(10, fy*.3); ctx.lineTo(s.len*.95, fy); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1; }
function drawProj(p, now){
  const pim = projImg(p);
  if (pim && p.kind !== 'black' && p.kind !== 'roam' && p.kind !== 'mouse'){ drawProjImg(p, pim); return; }
  switch (p.kind){
    case 'churu': { const a = Math.atan2(p.vy, p.vx); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#f39a3d'; ctx.strokeStyle = '#8a4a12'; ctx.lineWidth = 1.5; ell(0, 0, 10, 5.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ell(2, -2, 3, 1.5); ctx.fill(); ctx.restore(); break; }
    case 'cannon': { const a = Math.atan2(p.vy, p.vx); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#ee7a26'; ctx.strokeStyle = '#7a3a0a'; ctx.lineWidth = 2.5; ell(0, 0, 24, 15); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ell(6, -5, 7, 3); ctx.fill(); ctx.restore(); break; }
    case 'laser': { const col = p.rainbow ? `hsl(${(now*240 + p.hs.size*0 + p.x*.3) % 360} 90% 60%)` : '#ff2b45';
      ctx.fillStyle = p.rainbow ? 'rgba(255,255,255,.25)' : 'rgba(255,60,80,.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r*2.1, 0, TAU); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r*.4, 0, TAU); ctx.fill(); break; }
    case 'yarn': case 'spiral': { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin || 0); ctx.fillStyle = p.kind === 'spiral' ? '#6a4fd8' : '#8b72ea'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-p.r*.2, 0, p.r*.7, -1, 1); ctx.moveTo(p.r*.6, -p.r*.6); ctx.arc(0, 0, p.r*.5, -.8, 2); ctx.stroke(); ctx.restore(); break; }
    case 'mouse': { const k = (p.r || 11) / 11; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k); drawMouse(0, 0, p.ang, p.gold); ctx.restore(); break; }
    case 'roam': { if (p.trail.length > 3){ ctx.strokeStyle = 'rgba(139,114,234,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.trail[0], p.trail[1]); for (let k = 2; k < p.trail.length; k += 2) ctx.lineTo(p.trail[k], p.trail[k+1]); ctx.stroke(); }
      drawMouse(p.x, p.y, Math.atan2(p.vy, p.vx) - Math.PI/2, true); break; }
    case 'bubble': { ctx.fillStyle = 'rgba(150,215,255,.35)'; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - p.r*.35, p.y - p.r*.35, p.r*.22, 0, TAU); ctx.fill(); break; }
    case 'black': { ctx.strokeStyle = p.disco ? 'rgba(255,120,220,.5)' : 'rgba(150,120,255,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.pullR * (.6 + .4*((now*1.5) % 1)), 0, TAU); ctx.stroke();
      if (pim){ spin(pim, p.x, p.y, now*4, p.r*2.2, p.r*2.2); break; }
      ctx.fillStyle = p.disco ? 'rgba(120,30,110,.75)' : 'rgba(60,40,140,.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r*.55, now*4, now*4 + 4); ctx.stroke(); break; }
  }
}
function drawZone(z){
  const f = Math.min(1, z.life / .4);
  if (z.kind === 'catnip'){
    // 캣닢 장판: 옅은 바닥색 + 흩날리는 파티클 (잎·꽃·반짝이)
    ctx.fillStyle = `rgba(110,190,80,${.14*f})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
    for (const q of z.parts || []){
      const a = Math.max(0, Math.min(1, q.t / .2, (q.life - q.t) / .35)) * f; if (!a) continue;
      const im = IMG['part:' + q.k], s = q.k === 'sparkle' ? q.s * (.65 + .35*Math.sin(q.t*9)) : q.s;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(q.x, q.y); if (q.k !== 'sparkle') ctx.rotate(q.rot);
      if (im) fitC(im, 0, 0, s, s);
      else { ctx.fillStyle = q.k === 'petal' ? '#f6b6cf' : q.k === 'sparkle' ? '#f3f7a8' : '#5aa64f'; ell(0, 0, s*.5, s*.3); ctx.fill(); }
      ctx.restore();
    }
    return;
  }
  const zim = IMG['zone:puddle'];
  if (zim){ ctx.save(); ctx.globalAlpha = f * .55; fitC(zim, z.x, z.y, z.r*2, z.kind === 'catnip' ? z.r*2 : z.r*1.5); ctx.restore(); return; }
  if (z.kind === 'catnip'){ ctx.fillStyle = `rgba(110,190,80,${.32*f})`; ctx.strokeStyle = `rgba(70,140,50,${.7*f})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(60,130,50,${.8*f})`; for (let k = 0; k < 6; k++){ const a = k*1.05 + z.x*.01, rr = z.r*(.3 + .5*hash(k, z.x|0)); ell(z.x + Math.cos(a)*rr, z.y + Math.sin(a)*rr, 4, 2.5); ctx.fill(); } }
  else { ctx.fillStyle = `rgba(240,140,60,${.35*f})`; ell(z.x, z.y, z.r, z.r*.75); ctx.fill(); }
}
function drawFx(f){
  const k = f.t / f.dur;
  if (f.k === 'ring' && IMG['fx:ring']){ ctx.save(); ctx.globalAlpha = 1 - k; const d = f.r*2*(.4 + .6*k); fitC(IMG['fx:ring'], f.x, f.y, d, d); ctx.restore(); }
  else if (f.k === 'ring'){ ctx.strokeStyle = f.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.4 + .6*k), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'mark'){ ctx.strokeStyle = 'rgba(214,69,93,.9)'; ctx.fillStyle = `rgba(31,42,68,${.15 + .3*k})`; ctx.lineWidth = 3; ctx.setLineDash([6,5]); ell(f.x, f.y, f.r, f.r*.45); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
  else if (f.k === 'text'){ ctx.globalAlpha = 1 - k; ctx.fillStyle = f.col; ctx.font = '16px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.txt, f.x, f.y - k*24); ctx.globalAlpha = 1; }
}

window.NYANG_SPR = {
  use, drawCatBody, drawStudent, drawPick, drawMouse, drawWeaponAuras, drawWeaponFront, drawSweep, drawProj, drawZone, drawFx, preview,
  HAIR_COLORS, SKINS, CATALOG, GROUPS,
  has: key => !!OVR[key], isOld: key => !!(META[key] && META[key].off), hasBase: key => BUNDLED.includes(key), fileOf,
  url: key => META[key] && META[key].off ? null : URLS[key] || (BASE[key] ? baseUrl(key) : null), meta: key => META[key] || null, get ready(){ return ready; },
  put, remove, removeAll, useOld, onChange(fn){ listeners.add(fn); return () => listeners.delete(fn); },
};
loadAll();
})();
