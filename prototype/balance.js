/* 냥이를 뚫고 등교하라 · 게임 수치 데이터 (무기·패시브·고양이)
   게임(index.html)과 관리자 페이지(admin.html)가 같이 읽는다.
   관리자 페이지에서 고친 값은 localStorage('nyang-tune-v1')에 기본값과 다른 것만 저장된다. */
(() => {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const WEAPONS = {
  /* 레벨 표는 뱀파이어 서바이버즈의 비슷한 무기를 그대로 따른다 (괄호 안이 원본 무기) */
  churu:   { name:'츄르', s:'츄', col:'#ef8a3a', pair:'lunch', evo:'cannon', unlock:'기본 제공', ref:'Magic Wand', sd:'가까운 고양이에게 연속 발사',
             desc:'가장 가까운 고양이에게 츄르 방울을 0.1초 간격으로 차례로 발사',
             lv:[[10,1.2,1,1,'기본'],[10,1.2,2,1,'발사 수 +1'],[10,1.0,2,1,'쿨다운 -0.2초'],[10,1.0,3,1,'발사 수 +1'],[20,1.0,3,1,'피해 +10'],[20,1.0,4,1,'발사 수 +1'],[20,1.0,4,2,'관통 +1'],[30,1.0,4,2,'피해 +10']]
             .map(([d,cd,n,p,c])=>({d,cd,n,p,c})) },
  feather: { name:'깃털 낚싯대', s:'깃', col:'#e46aa6', pair:'shoes', evo:'pinwheel', unlock:'기본 제공', ref:'Whip', sd:'앞쪽을 가로로 휘두르기',
             desc:'바라보는 방향으로 깃털을 가로로 휘둘러 닿은 고양이 모두에게 피해. 20% 확률로 2배 피해',
             lv:[[10,1.35,1,1,'기본'],[10,1.35,2,1,'뒤쪽 휘두르기 추가'],[15,1.35,2,1,'피해 +5'],[20,1.35,2,1.1,'범위 +10%, 피해 +5'],[25,1.35,2,1.1,'피해 +5'],[30,1.35,2,1.2,'범위 +10%, 피해 +5'],[35,1.35,2,1.2,'피해 +5'],[40,1.35,2,1.2,'피해 +5']]
             .map(([d,cd,dir,area,c])=>({d,cd,dir,area,c})) },
  laser:   { name:'레이저 포인터', s:'레', col:'#e0334a', pair:'battery', evo:'mirrorball', unlock:'기본 제공', ref:'Runetracer', sd:'튕기며 관통하는 빨간 점',
             desc:'무작위 방향으로 빨간 점을 쏜다. 화면 가장자리에 튕기며 닿은 고양이를 모두 관통',
             lv:[[10,3,1,2.25,1,'기본'],[15,3,1,2.25,1.2,'피해 +5, 속도 +20%'],[20,3,1,2.5,1.2,'피해 +5, 지속 +0.25초'],[20,3,2,2.5,1.2,'점 +1'],[25,3,2,2.5,1.4,'피해 +5, 속도 +20%'],[30,3,2,2.75,1.4,'피해 +5, 지속 +0.25초'],[30,3,3,2.75,1.4,'점 +1'],[30,3,3,3.25,1.4,'지속 +0.5초']]
             .map(([d,cd,n,dur,spd,c])=>({d,cd,n,dur,spd,c})) },
  catnip:  { name:'캣닢 봉지', s:'캣', col:'#5aa64f', pair:'ears', evo:'flowerfield', unlock:'기본 제공', ref:'Santa Water', sd:'주변에 캣닢 장판',
             desc:'캣닢 봉지를 떨어뜨려 장판을 만든다. 첫 봉지는 가장 가까운 고양이에게, 나머지는 주변을 시계 방향으로 돌며 떨어진다',
             lv:[[10,4.5,1,1,2,'기본'],[10,4.5,2,1.2,2,'장판 +1, 범위 +20%'],[20,4.5,2,1.2,2.5,'피해 +10, 유지 +0.5초'],[20,4.5,3,1.4,2.5,'장판 +1, 범위 +20%'],[30,4.5,3,1.4,2.75,'피해 +10, 유지 +0.25초'],[30,4.5,4,1.6,2.75,'장판 +1, 범위 +20%'],[35,4.5,4,1.6,3,'피해 +5, 유지 +0.25초'],[40,4.5,4,1.8,3,'피해 +5, 범위 +20%']]
             .map(([d,cd,n,area,dur,c])=>({d,cd,n,area,dur,c})) },
  yarn:    { name:'털실뭉치', s:'털', col:'#7b62e0', pair:'refill', evo:'yarnstorm', unlock:'7분 30초 생존', ref:'Axe', sd:'위로 던져 관통',
             desc:'첫 털실은 곧장 위로, 다음 털실은 바라보는 쪽으로 점점 넓게 던진다. 떨어지며 관통하고 30% 확률로 2배 피해',
             lv:[[20,4,1,3,'기본'],[20,4,2,3,'투척 +1'],[40,4,2,3,'피해 +20'],[40,4,2,5,'관통 +2'],[40,4,3,5,'투척 +1'],[60,4,3,5,'피해 +20'],[60,4,3,7,'관통 +2'],[80,4,3,7,'피해 +20']]
             .map(([d,cd,n,p,c])=>({d,cd,n,p,c})) },
  mouse:   { name:'태엽 쥐돌이', s:'쥐', col:'#7d8796', pair:'clock', evo:'infmouse', unlock:'태엽 알람시계 Lv5 달성', ref:'King Bible', sd:'주위를 도는 쥐돌이',
             desc:'쥐돌이가 플레이어 주위를 시계 방향으로 돈다. 지속 시간이 끝나야 쿨다운이 시작된다',
             lv:[[10,3,1,3,1,1,'기본'],[10,3,2,3,1,1,'쥐돌이 +1'],[10,3,2,3,1.25,1.3,'범위 +25%, 회전 속도 +30%'],[20,3,2,3.5,1.25,1.3,'피해 +10, 지속 +0.5초'],[20,3,3,3.5,1.25,1.3,'쥐돌이 +1'],[20,3,3,3.5,1.5,1.6,'범위 +25%, 회전 속도 +30%'],[30,3,3,4,1.5,1.6,'피해 +10, 지속 +0.5초'],[30,3,4,4,1.5,1.6,'쥐돌이 +1']]
             .map(([d,cd,n,dur,area,rot,c])=>({d,cd,n,dur,area,rot,c})) },
  matatabi:{ name:'마따따비 향주머니', s:'마', col:'#3f9b8a', pair:'milk', evo:'forest', unlock:'고양이 누적 5,000마리 만족', ref:'Garlic', sd:'주변 고양이에게 피해',
             desc:'플레이어 주변 향기 오라. 들어온 고양이는 바로 피해를 입고 쿨다운마다 다시 맞는다. 맞을수록 넉백이 세진다',
             lv:[[5,1.3,1,'기본'],[7,1.3,1.4,'범위 +40%, 피해 +2'],[8,1.2,1.4,'쿨다운 -0.1초, 피해 +1'],[9,1.2,1.6,'범위 +20%, 피해 +1'],[11,1.1,1.6,'쿨다운 -0.1초, 피해 +2'],[12,1.1,1.8,'범위 +20%, 피해 +1'],[13,1.0,1.8,'쿨다운 -0.1초, 피해 +1'],[15,1.0,2,'범위 +20%, 피해 +2']]
             .map(([d,cd,area,c])=>({d,cd,area,c})) },
  bubble:  { name:'비눗방울 건', s:'방', col:'#37a3d8', pair:'magnet', evo:'blackhole', unlock:'첫 등교 성공', ref:'Fire Wand', sd:'부채꼴로 방울 3개',
             desc:'무작위 고양이 쪽으로 비눗방울 3개를 부채꼴로 쏜다. 천천히 날아가 처음 닿은 고양이에게 터진다',
             lv:[[20,3,3,.75,'기본'],[30,3,3,.75,'피해 +10'],[40,3,3,.95,'피해 +10, 속도 +20%'],[50,3,3,.95,'피해 +10'],[60,3,3,1.15,'피해 +10, 속도 +20%'],[70,3,3,1.15,'피해 +10'],[80,3,3,1.35,'피해 +10, 속도 +20%'],[90,3,3,1.35,'피해 +10']]
             .map(([d,cd,n,spd,c])=>({d,cd,n,spd,c})) },
};
const PASSIVES = {
  lunch:  { name:'든든한 도시락', s:'도', col:'#d0643c', max:5, per:'공격력 +10%', tot:l=>`공격력 +${l*10}%`, pair:'churu' },
  shoes:  { name:'운동화', s:'운', col:'#3c7bd0', max:5, per:'이동속도 +10%', tot:l=>`이동속도 +${l*10}%`, pair:'feather' },
  battery:{ name:'보조배터리', s:'배', col:'#4c9a3c', max:5, per:'지속시간 +10%', tot:l=>`지속시간 +${l*10}%`, pair:'laser' },
  ears:   { name:'냥이 귀 머리띠', s:'귀', col:'#c25ba0', max:5, per:'범위 +10%', tot:l=>`범위 +${l*10}%`, pair:'catnip' },
  refill: { name:'대용량 리필팩', s:'리', col:'#8a5cc2', max:2, per:'투사체 수 +1', tot:l=>`투사체 수 +${l}`, pair:'yarn' },
  clock:  { name:'태엽 알람시계', s:'알', col:'#c29a2c', max:5, per:'쿨다운 -8%', tot:l=>`쿨다운 -${l*8}%`, pair:'mouse' },
  milk:   { name:'바나나우유', s:'우', col:'#e2b93b', max:5, per:'최대체력 +10%, 회복 +0.1/초', tot:l=>`체력 +${l*10}%, 회복 +${(l*0.1).toFixed(1)}/초`, pair:'matatabi' },
  magnet: { name:'자석 필통', s:'자', col:'#5a6b86', max:5, per:'하트 줍는 범위 +25%', tot:l=>`하트 줍는 범위 +${l*25}%`, pair:'bubble' },
};
const EVOS = {
  cannon:     { name:'참치맛 츄르 대포', s:'대', col:'#e8702a', from:'churu',   desc:'거대한 츄르 덩어리를 관통 발사. 지나간 자리에 츄르 웅덩이' },
  pinwheel:   { name:'바람개비 깃털', s:'개', col:'#e05a9a', from:'feather',    desc:'주변 360도 회전 베기. 이동 중엔 더 빠르고 세다' },
  mirrorball: { name:'미러볼 레이저쇼', s:'볼', col:'#d93a6a', from:'laser',    desc:'사라지지 않는 레이저 점이 사방을 누빈다' },
  flowerfield:{ name:'캣닢 꽃밭', s:'꽃', col:'#4f9d3f', from:'catnip',         desc:'따라다니며 커지는 장판. 위의 고양이는 제자리에 멈춘다' },
  yarnstorm:  { name:'털실 폭풍', s:'풍', col:'#6a4fd8', from:'yarn',           desc:'털실 여러 개가 회오리치며 화면을 쓸고 지나간다' },
  infmouse:   { name:'무한태엽 쥐돌이', s:'무', col:'#6d7686', from:'mouse',    desc:'멈추지 않고 영구 공전. 쥐돌이 수 +2' },
  forest:     { name:'마따따비 숲', s:'숲', col:'#2f8a76', from:'matatabi',     desc:'오라 범위 2배. 만족시킨 고양이 수만큼 체력 회복' },
  blackhole:  { name:'블랙홀 비눗방울', s:'홀', col:'#4a3a9a', from:'bubble',   desc:'큰 방울이 주변 고양이를 빨아들인 뒤 한꺼번에 터진다' },
};
const UPPERS = {
  disco:   { name:'냥냥 디스코 파티', s:'디', col:'#b8329c', a:'mirrorball', b:'blackhole', desc:'방울이 고양이를 모으면 레이저가 그 자리에 집중된다' },
  paradise:{ name:'고양이 낙원', s:'낙', col:'#2f9a5a', a:'flowerfield', b:'forest',      desc:'넓은 낙원 안의 고양이는 멈춰 뒹굴고, 만족시킬 때마다 체력 회복' },
  legion:  { name:'털실 쥐돌이 군단', s:'군', col:'#5b4fb8', a:'yarnstorm', b:'infmouse',  desc:'쥐돌이들이 털실을 끌고 다니며 걸린 고양이를 묶어 둔다' },
  tornado: { name:'츄르 회오리', s:'회', col:'#e0602a', a:'cannon', b:'pinwheel',          desc:'회전하는 깃털이 츄르를 사방으로 뿌리고 웅덩이를 남긴다' },
};
const CATS = {
  baby:  { name:'아기 고양이', hp:5,  spd:50, dmg:3,  r:9,  col:'#f2c49a', xp:1 },
  stray: { name:'길냥이',      hp:14, spd:62, dmg:5,  r:12, col:'#a39486', xp:1, stripes:'#7a6c60' },
  dash:  { name:'우다다 냥이', hp:10, spd:42, dmg:6,  r:11, col:'#e6a54c', xp:2, stripes:'#c27f2a' },
  fat:   { name:'뚱냥이',      hp:70, spd:34, dmg:8,  r:18, col:'#e9e3d6', xp:3, kb:.25, patch:'#9a8f80' },
  black: { name:'검은 고양이 무리', hp:30, spd:175, dmg:15, r:12, col:'#26262f', xp:2, light:true },
  wall:  { name:'담벼락 냥이', hp:25, spd:62, dmg:10, r:13, col:'#8094aa', xp:2, stripes:'#5f7288' },
  elite: { name:'대장 고양이', hp:400, spd:56, dmg:12, r:12*1.2, col:'#8c6a48', xp:25, elite:true, stripes:'#5e452c', kb:.3 },
  cheese:{ name:'뚱보 치즈', hp:2600, spd:50, dmg:18, r:12*1.5, col:'#f2ad3a', boss:true, stripes:'#d18720', summon:['baby',6,7] },
  sam:   { name:'골목대장 삼색이', hp:7500, spd:58, dmg:20, r:12*1.8, col:'#fbf4e8', boss:true, calico:true, dashEvery:4 },
  tux:   { name:'냥아치 대장 턱시도', hp:16000, spd:56, dmg:22, r:12*2, col:'#2b2b34', boss:true, tux:true, light:true, summon:['stray',7,6] },
  king:  { name:'등교 저지 위원장 왕고양이', hp:42000, spd:50, dmg:26, r:12*2.5, col:'#c9c2b6', boss:true, crown:true, stripes:'#8f877b', dashEvery:5, summon:['dash',6,7] },
};

/* ---------- 무기 밸런스 (조정 도구가 고치는 값) ---------- */
const LV_FIELDS = { d:['피해',''], cd:['쿨다운','초'], n:['개수',''], dir:['휘두르기 수',''], area:['범위','배'], dur:['지속','초'], spd:['속도','배'], size:['크기','배'], p:['관통',''], rot:['회전','배'], tick:['주기','초'], kb:['넉백','0~3'] };
const N_NAME = { churu:'발사 수', laser:'점', catnip:'장판', yarn:'투척', mouse:'쥐돌이', bubble:'방울' };
const TUNE_DEF = {
  churu:      { spd:[440,'탄속'], range:[720,'조준 거리'], life:[1.4,'날아가는 시간(초)'], gap:[.1,'연속 발사 간격(초)'] },
  feather:    { len:[118,'휘두르기 길이'], wid:[54,'휘두르기 폭'], gap:[.1,'다음 휘두르기 간격(초)'], crit:[.2,'치명타 확률'], critMul:[2,'치명타 배율'] },
  laser:      { spd:[270,'기본 속도'], r:[7,'점 크기'], gap:[.2,'연속 발사 간격(초)'], hit:[.5,'같은 고양이 재타격 간격(초)'] },
  catnip:     { r:[60,'장판 반경'], ring:[110,'주변 투척 거리'], gap:[.3,'연속 투척 간격(초)'], hit:[.5,'같은 고양이 재타격 간격(초)'], slow:[0,'감속 비율 (원본엔 없음)'],
                pRate:[16,'파티클 수 (초당, 기본 반경 기준)'], pSpeed:[26,'파티클 떠오르는 속도'], pSize:[13,'파티클 크기'], pLife:[1.3,'파티클 수명(초)'] },
  yarn:       { r:[11,'털실 크기'], life:[1.7,'체공 시간(초)'], gap:[.2,'연속 투척 간격(초)'], spread:[70,'옆으로 벌어지는 속도'], crit:[.3,'치명타 확률'], critMul:[2,'치명타 배율'] },
  mouse:      { rad:[64,'공전 반경'], rot:[3,'기본 회전 속도'], r:[11,'쥐돌이 크기'], hit:[1.7,'같은 고양이 재타격 간격(초)'] },
  matatabi:   { r:[72,'오라 반경'], kb:[.3,'맞을 때마다 넉백 증가'], kbMax:[1.5,'넉백 최대치'], push:[110,'넉백 1당 밀어내는 힘'] },
  bubble:     { spd:[200,'기본 속도 (100%)'], r:[10,'방울 크기'], life:[3,'날아가는 시간(초)'], fan:[12,'부채꼴 간격(도)'], boom:[0,'터질 때 범위 (0 = 맞은 고양이만)'] },
  cannon:     { d:[40,'피해'], cd:[1,'쿨다운(초)'], n:[4,'발사 수'], spd:[380,'탄속'], pdps:[14,'웅덩이 초당 피해'] },
  pinwheel:   { d:[35,'피해'], len:[125,'날개 길이'], rot:[4,'회전 속도'], moveRot:[3,'이동 중 추가 회전'], moveMul:[1.2,'이동 중 피해 배율'] },
  mirrorball: { d:[25,'피해'], n:[4,'점 개수'], spd:[330,'속도'] },
  flowerfield:{ dps:[40,'초당 피해'], r0:[90,'시작 반경'], r1:[200,'최대 반경'], grow:[6,'다 커지는 시간(초)'] },
  yarnstorm:  { d:[45,'피해'], cd:[2.2,'쿨다운(초)'], n:[5,'털실 수'], r:[18,'털실 크기'], life:[2.6,'지속(초)'] },
  infmouse:   { d:[25,'피해'], n:[6,'쥐돌이 수'], rad:[100,'공전 반경'], rot:[4.8,'회전 속도'] },
  forest:     { d:[16,'피해'], tick:[.4,'피해 주기(초)'], r:[230,'오라 반경'] },
  blackhole:  { d:[90,'피해'], cd:[3,'쿨다운(초)'], pull:[200,'흡입 반경'], boom:[130,'폭발 반경'] },
  disco:      { d:[40,'레이저 피해'], n:[6,'레이저 점 수'], bd:[140,'방울 폭발 피해'], cd:[2.5,'방울 쿨다운(초)'] },
  paradise:   { dps:[50,'초당 피해'], r:[270,'낙원 반경'] },
  legion:     { d:[30,'쥐돌이 피해'], n:[6,'쥐돌이 수'], rad:[105,'공전 반경'], yd:[30,'털실 피해'], cd:[1.2,'털실 쿨다운(초)'] },
  tornado:    { d:[45,'날개 피해'], len:[140,'날개 길이'], cdmg:[30,'츄르 피해'], cd:[.3,'츄르 쿨다운(초)'], pdps:[15,'웅덩이 초당 피해'] },
};
const K = {}; for (const [id, o] of Object.entries(TUNE_DEF)){ K[id] = {}; for (const k in o) K[id][k] = o[k][0]; }
const LV_DEFAULT = Object.fromEntries(Object.entries(WEAPONS).map(([id, W]) => [id, W.lv.map(l => ({ ...l }))]));
const INT_KEYS = new Set(['n', 'dir', 'p']), MIN_KEYS = new Set(['cd', 'tick', 'hit']);
const TUNE_KEY = 'nyang-tune-v1';
function cleanVal(k, v){ if (INT_KEYS.has(k)) v = Math.round(v); if (k === 'dir') v = Math.max(1, v); if (MIN_KEYS.has(k)) v = Math.max(.05, v); return Math.max(0, v); }
function autoText(id, a, b){
  const out = [];
  for (const f in b){ if (f === 'c' || a[f] === b[f]) continue; const dv = b[f] - a[f], sg = dv > 0 ? '+' : '-', av = Math.abs(dv);
    const nm = f === 'n' ? (N_NAME[id] || '개수') : LV_FIELDS[f][0];
    if (f === 'dir') out.push(a.dir === 1 && b.dir === 2 ? '뒤쪽 휘두르기 추가' : `휘두르기 ${sg}${av}`);
    else if (f === 'kb') out.push(dv > 0 ? '넉백 강화' : '넉백 약화');
    else if (LV_FIELDS[f][1] === '배') out.push(`${nm} ${sg}${Math.round(av*100)}%`);
    else if (LV_FIELDS[f][1] === '초') out.push(`${nm} ${sg}${+av.toFixed(2)}초`);
    else out.push(`${nm} ${sg}${+av.toFixed(2)}`); }
  return out.join(', ') || '변화 없음';
}
function lvChanged(id){ return WEAPONS[id].lv.some((l, i) => Object.keys(l).some(f => f !== 'c' && l[f] !== LV_DEFAULT[id][i][f])); }
function relabel(id){ const W = WEAPONS[id], ch = lvChanged(id); W.lv.forEach((l, i) => { l.c = ch && i ? autoText(id, W.lv[i-1], l) : LV_DEFAULT[id][i].c; }); }
function tuneDiff(){
  const out = {};
  for (const id in WEAPONS) if (lvChanged(id)) (out[id] = out[id] || {}).lv = WEAPONS[id].lv.map((l, i) => { const r = {}; for (const f in l) if (f !== 'c' && l[f] !== LV_DEFAULT[id][i][f]) r[f] = l[f]; return r; });
  for (const id in K){ const o = {}; for (const k in K[id]) if (K[id][k] !== TUNE_DEF[id][k][0]) o[k] = K[id][k]; if (Object.keys(o).length) (out[id] = out[id] || {}).k = o; }
  return out;
}
function applyTune(t){
  for (const id in WEAPONS) WEAPONS[id].lv.forEach((l, i) => Object.assign(l, LV_DEFAULT[id][i]));
  for (const id in K) for (const k in K[id]) K[id][k] = TUNE_DEF[id][k][0];
  for (const [id, o] of Object.entries(t && typeof t === 'object' ? t : {})){
    if (WEAPONS[id] && Array.isArray(o.lv)) o.lv.forEach((r, i) => { const l = WEAPONS[id].lv[i]; if (l && r) for (const f in r) if (f !== 'c' && f in l && Number.isFinite(+r[f])) l[f] = cleanVal(f, +r[f]); });
    if (K[id] && o.k) for (const k in o.k) if (k in K[id] && Number.isFinite(+o.k[k])) K[id][k] = cleanVal(k, +o.k[k]);
  }
  for (const id in WEAPONS) relabel(id);
}
function saveTune(){ try { localStorage.setItem(TUNE_KEY, JSON.stringify(tuneDiff())); } catch(_){} }
function loadTune(){ try { return JSON.parse(localStorage.getItem(TUNE_KEY) || '{}') || {}; } catch(_){ return {}; } }
applyTune(loadTune());
// 관리자 페이지가 다른 탭에서 값을 바꾸면 열려 있는 게임에도 바로 반영
window.addEventListener('storage', e => { if (e.key === TUNE_KEY) applyTune(loadTune()); });

window.NYANG_BAL = { WEAPONS, EVOS, UPPERS, PASSIVES, CATS, K, TUNE_DEF, LV_DEFAULT, LV_FIELDS, N_NAME, TUNE_KEY, cleanVal, relabel, tuneDiff, applyTune, saveTune, loadTune };
})();
