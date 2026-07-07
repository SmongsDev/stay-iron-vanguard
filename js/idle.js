// idle.js — 오프라인 정산, 전초기지 (단일 책임: 방치 수익)
'use strict';

function outpostRate(level) {
  return CONST.OUTPOST_RATE_BASE * Math.pow(CONST.OUTPOST_RATE_GROWTH, level - 1);
}

function outpostUpgradeCost(level) {
  return Math.floor(CONST.OUTPOST_COST_BASE * Math.pow(CONST.OUTPOST_COST_GROWTH, level - 1));
}

// 온라인 중 초당 크레딧 자동 수급
function outpostTick(dtMs) {
  state.credits += outpostRate(state.outpostLevel) * (dtMs / 1000);
}

function upgradeOutpost() {
  const cost = outpostUpgradeCost(state.outpostLevel);
  if (state.credits < cost) return false;
  state.credits -= cost;
  state.outpostLevel += 1;
  return true;
}

// 오프라인 정산: 이탈 시간 × 현재 스테이지 기준 수익률 (상한 12h)
// 반환: { ms, capped, credits, gems }
function settleOffline(elapsedMs) {
  const capped = elapsedMs > CONST.OFFLINE_CAP_MS;
  const ms = Math.min(elapsedMs, CONST.OFFLINE_CAP_MS);
  const sec = ms / 1000;
  const idx = state.stageIndex;

  // 전투 추정 수익 + 전초기지 수익
  const combatCredits = creditPerKill(idx, false) * CONST.OFFLINE_KILLS_PER_SEC * sec;
  const outpostCredits = outpostRate(state.outpostLevel) * sec;
  const credits = Math.floor(combatCredits + outpostCredits);
  const gems = Math.floor(CONST.GEM_PER_KILL * CONST.OFFLINE_KILLS_PER_SEC * sec);

  state.credits += credits;
  state.gems += gems;
  return { ms, capped, credits, gems };
}
