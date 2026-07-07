// combat.js — 자동 전투 루프, 스테이지, 버스트 (단일 책임: 전투 규칙)
'use strict';

// 전투 런타임 (비영속). 매 세션 초기화된다.
const rt = {
  enemyHp: 0,
  enemyMaxHp: 0,
  boss: false,
  bossTimerMs: 0,
  burst: 0,
  burstActive: false,
  burstTimerMs: 0,
  farming: false,        // 보스 실패 후 직전 스테이지 파밍 모드
  blockedBoss: -1,       // 재도전 대상 보스 stageIndex
  burstJustTriggered: false, // UI 연출 소비용 1회성 플래그
  lastKillReward: null,      // { credits, gems } UI 표시용
};

// ── 파생 스탯 계산 ─────────────────────────────────────────
function nikkeAtk(id) {
  const base = ROSTER_MAP[id];
  const ns = getNikkeState(id);
  if (!base || !ns) return 0;
  return base.baseAtk
    * (1 + CONST.ATK_PER_LEVEL * (ns.level - 1))
    * (1 + CONST.ATK_PER_CORE * ns.core);
}

function levelUpCost(level) {
  return Math.floor(CONST.LEVEL_COST_BASE * Math.pow(CONST.LEVEL_COST_GROWTH, level - 1));
}

function teamDPS() {
  let sum = 0;
  for (const id of state.team) sum += nikkeAtk(id);
  return sum;
}

// 광고 DPS 부스트 배율 (활성 시 AD_BOOST_MULT, 아니면 1). 오프라인 정산에는 미적용.
function boostActive() {
  return Date.now() < (state.boostUntil || 0);
}
function boostMult() {
  return boostActive() ? CONST.AD_BOOST_MULT : 1;
}

// 편성에 버스트 I, II, III 타입이 모두 존재해야 풀버스트 가능
function teamCanFullBurst() {
  const types = { 1: false, 2: false, 3: false };
  for (const id of state.team) {
    const base = ROSTER_MAP[id];
    if (base) types[base.burst] = true;
  }
  return types[1] && types[2] && types[3];
}

// ── 스테이지 초기화 ────────────────────────────────────────
function enemyMaxHpFor(stageIndex, boss) {
  let hp = CONST.ENEMY_HP_BASE * Math.pow(CONST.ENEMY_HP_GROWTH, stageIndex);
  if (boss) hp *= CONST.BOSS_HP_MULT;
  return hp;
}

function creditPerKill(stageIndex, boss) {
  let c = CONST.CREDIT_PER_KILL_BASE * Math.pow(CONST.CREDIT_KILL_GROWTH, stageIndex);
  if (boss) c *= CONST.BOSS_REWARD_MULT;
  return Math.max(1, Math.floor(c));
}

// 실제 전투가 벌어지는 스테이지 (파밍 중이면 직전 스테이지)
function activeStageIndex() {
  return rt.farming ? Math.max(0, state.stageIndex) : state.stageIndex;
}

function initStage() {
  const idx = activeStageIndex();
  rt.boss = !rt.farming && isBossStage(idx);
  rt.enemyMaxHp = enemyMaxHpFor(idx, rt.boss);
  rt.enemyHp = rt.enemyMaxHp;
  rt.bossTimerMs = rt.boss ? CONST.BOSS_TIME_LIMIT_MS : 0;
}

// ── 전투 틱 ────────────────────────────────────────────────
function combatTick(dtMs) {
  // 버스트 지속/종료
  if (rt.burstActive) {
    rt.burstTimerMs -= dtMs;
    if (rt.burstTimerMs <= 0) {
      rt.burstActive = false;
      rt.burstTimerMs = 0;
      rt.burst = 0; // 발동 후 게이지 리셋(쿨다운 개념)
    }
  } else {
    // 게이지 충전 (시간 기반)
    if (rt.burst < CONST.BURST_MAX) {
      rt.burst = Math.min(CONST.BURST_MAX, rt.burst + CONST.BURST_CHARGE_PER_TICK);
    }
    // 만충 + 조건 충족 시 자동 풀버스트
    if (rt.burst >= CONST.BURST_MAX && teamCanFullBurst()) {
      triggerFullBurst();
    }
  }

  // 데미지 적용 (오버드라이브 배율 × 광고 부스트 배율 곱연산)
  const mult = rt.burstActive ? CONST.BURST_MULT : 1;
  const dmg = teamDPS() * (dtMs / 1000) * mult * boostMult();
  if (dmg > 0) rt.enemyHp -= dmg;

  // 보스 시간제한
  if (rt.boss && !rt.farming) {
    rt.bossTimerMs -= dtMs;
    if (rt.enemyHp > 0 && rt.bossTimerMs <= 0) {
      onBossTimeout();
      return;
    }
  }

  if (rt.enemyHp <= 0) onKill();
}

function triggerFullBurst() {
  rt.burstActive = true;
  rt.burstTimerMs = CONST.BURST_DURATION_MS;
  rt.burstJustTriggered = true; // UI가 소비
}

function onKill() {
  const idx = activeStageIndex();
  const boss = rt.boss;
  const credits = creditPerKill(idx, boss);
  const gems = boss ? CONST.GEM_PER_BOSS : CONST.GEM_PER_KILL;
  state.credits += credits;
  state.gems += gems;
  state.stats.kills += 1;
  rt.lastKillReward = { credits, gems };

  // 버스트 게이지 처치 충전
  if (!rt.burstActive) {
    rt.burst = Math.min(CONST.BURST_MAX, rt.burst + CONST.BURST_CHARGE_PER_KILL);
  }

  if (rt.farming) {
    // 파밍 모드: 같은 스테이지 반복 (진행 없음)
    initStage();
    return;
  }

  // 정상 진행
  state.stageIndex += 1;
  if (state.stageIndex > state.maxStageIndex) state.maxStageIndex = state.stageIndex;
  initStage();
}

function onBossTimeout() {
  // 보스 실패 → 직전 스테이지 파밍 모드 진입
  rt.blockedBoss = state.stageIndex;
  rt.farming = true;
  if (state.stageIndex > 0) state.stageIndex -= 1;
  initStage();
}

// 리셋 등 상태 교체 시 전투 런타임도 함께 초기화
function resetCombatRuntime() {
  rt.farming = false;
  rt.blockedBoss = -1;
  rt.burst = 0;
  rt.burstActive = false;
  rt.burstTimerMs = 0;
  rt.burstJustTriggered = false;
  rt.lastKillReward = null;
  initStage();
}

// 수동 재도전: 막힌 보스 스테이지로 복귀
function retryBoss() {
  if (!rt.farming) return;
  state.stageIndex = rt.blockedBoss;
  rt.farming = false;
  rt.blockedBoss = -1;
  initStage();
}
