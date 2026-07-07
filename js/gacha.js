// gacha.js — 모집(가차) (단일 책임: 확률 뽑기 + 지급)
'use strict';

function rollRarity() {
  const r = Math.random();
  if (r < CONST.RATES.SSR) return 'SSR';
  if (r < CONST.RATES.SSR + CONST.RATES.SR) return 'SR';
  return 'R';
}

function randomOfRarity(rarity) {
  const pool = ROSTER.filter((n) => n.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

// 단일 뽑기 결과 지급. 반환: { id, name, rarity, dup, maxed, refund }
function grantNikke(base) {
  const cur = state.nikkes[base.id];
  if (!cur) {
    state.nikkes[base.id] = { level: 1, core: 0 };
    return { id: base.id, name: base.name, rarity: base.rarity, dup: false, maxed: false, refund: 0 };
  }
  if (cur.core < CONST.MAX_CORE) {
    cur.core += 1;
    return { id: base.id, name: base.name, rarity: base.rarity, dup: true, maxed: false, refund: 0 };
  }
  // 만돌파 중복 → 크레딧 환급
  state.credits += CONST.CORE_REFUND;
  return { id: base.id, name: base.name, rarity: base.rarity, dup: true, maxed: true, refund: CONST.CORE_REFUND };
}

// count회 모집. gems 차감 후 결과 배열 반환. 부족 시 { ok:false }.
function pull(count) {
  const cost = count === 10 ? CONST.TEN_PULL_COST : CONST.PULL_COST * count;
  if (state.gems < cost) return { ok: false, reason: '젬이 부족합니다.' };
  state.gems -= cost;
  const results = [];
  for (let i = 0; i < count; i++) {
    const base = randomOfRarity(rollRarity());
    results.push(grantNikke(base));
  }
  state.stats.pulls += count;
  return { ok: true, results, cost };
}
