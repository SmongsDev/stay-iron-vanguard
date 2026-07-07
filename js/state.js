// state.js — 게임 상태, 저장/로드, 리셋 (단일 책임: 영속 상태 관리)
'use strict';

// 영속 상태. 파생값(atk 등)은 저장하지 않고 원천값(level/core 등)만 보관한다.
let state = null;

function newGame() {
  const nikkes = {};
  for (const s of STARTER) {
    nikkes[s.id] = { level: 1, core: s.core };
  }
  return {
    version: CONST.SAVE_VERSION,
    credits: 0,
    gems: 300,                 // 첫 모집 체험용 소량 지급
    nikkes,                    // { id: { level, core } } — 존재 = 보유
    team: STARTER.map((s) => s.id).slice(0, CONST.TEAM_SIZE),
    stageIndex: 0,             // 0-based 전역 스테이지 인덱스
    maxStageIndex: 0,          // 최고 도달 (오프라인 정산 기준)
    outpostLevel: 1,
    stats: { pulls: 0, kills: 0 },
    adGemReadyAt: 0,           // 무료 젬 광고 쿨다운 해제 시각 (epoch ms)
    boostUntil: 0,             // DPS 부스트 만료 시각 (epoch ms)
    lastSave: Date.now(),
  };
}

function isOwned(id) {
  return !!(state.nikkes && state.nikkes[id]);
}

function getNikkeState(id) {
  return state.nikkes[id] || null;
}

// 스테이지 표기: 챕터-스테이지 (1-1 …)
function stageLabel(stageIndex) {
  const chapter = Math.floor(stageIndex / CONST.STAGES_PER_CHAPTER) + 1;
  const stage = (stageIndex % CONST.STAGES_PER_CHAPTER) + 1;
  return chapter + '-' + stage;
}

function isBossStage(stageIndex) {
  return (stageIndex + 1) % CONST.BOSS_EVERY === 0;
}

// 로드: 실패 시 콘솔 경고 후 새 게임 (조용한 실패 금지)
function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(CONST.SAVE_KEY);
  } catch (e) {
    console.warn('[STAY] localStorage 접근 실패, 새 게임으로 시작:', e);
    state = newGame();
    return { fresh: true, elapsedMs: 0 };
  }
  if (!raw) {
    state = newGame();
    return { fresh: true, elapsedMs: 0 };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CONST.SAVE_VERSION) {
      console.warn('[STAY] 저장 버전 불일치 또는 손상, 새 게임으로 시작.');
      state = newGame();
      return { fresh: true, elapsedMs: 0 };
    }
    state = sanitize(parsed);
    const elapsedMs = Math.max(0, Date.now() - (parsed.lastSave || Date.now()));
    return { fresh: false, elapsedMs };
  } catch (e) {
    console.warn('[STAY] 저장 데이터 파싱 실패, 새 게임으로 시작:', e);
    state = newGame();
    return { fresh: true, elapsedMs: 0 };
  }
}

// 로드된 상태를 안전하게 정규화 (미보유 팀원 제거, 값 클램프)
function sanitize(p) {
  const s = newGame();
  s.credits = num(p.credits, 0);
  s.gems = num(p.gems, 0);
  s.stageIndex = Math.max(0, Math.floor(num(p.stageIndex, 0)));
  s.maxStageIndex = Math.max(s.stageIndex, Math.floor(num(p.maxStageIndex, 0)));
  s.outpostLevel = Math.max(1, Math.floor(num(p.outpostLevel, 1)));
  // 광고 상태: 음수 방지 + 조작된 미래 과도값 상한 (now + 부스트 최대 지속)
  const now = Date.now();
  s.adGemReadyAt = Math.max(0, Math.floor(num(p.adGemReadyAt, 0)));
  s.boostUntil = Math.min(now + CONST.AD_BOOST_DURATION_MS, Math.max(0, Math.floor(num(p.boostUntil, 0))));
  s.stats = {
    pulls: Math.max(0, Math.floor(num(p.stats && p.stats.pulls, 0))),
    kills: Math.max(0, Math.floor(num(p.stats && p.stats.kills, 0))),
  };
  s.nikkes = {};
  if (p.nikkes && typeof p.nikkes === 'object') {
    for (const id of Object.keys(p.nikkes)) {
      if (!ROSTER_MAP[id]) continue;           // 알 수 없는 id 무시
      const n = p.nikkes[id];
      s.nikkes[id] = {
        level: Math.max(1, Math.floor(num(n && n.level, 1))),
        core: Math.min(CONST.MAX_CORE, Math.max(0, Math.floor(num(n && n.core, 0)))),
      };
    }
  }
  if (Object.keys(s.nikkes).length === 0) {    // 보유 아스트라 전무 → 스타터 재지급
    for (const st of STARTER) s.nikkes[st.id] = { level: 1, core: st.core };
  }
  s.team = Array.isArray(p.team)
    ? p.team.filter((id) => s.nikkes[id]).slice(0, CONST.TEAM_SIZE)
    : [];
  if (s.team.length === 0) s.team = Object.keys(s.nikkes).slice(0, CONST.TEAM_SIZE);
  return s;
}

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function saveGame() {
  state.lastSave = Date.now();
  try {
    localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('[STAY] 저장 실패:', e);
    return false;
  }
}

function resetGame() {
  try {
    localStorage.removeItem(CONST.SAVE_KEY);
  } catch (e) {
    console.warn('[STAY] 저장 삭제 실패:', e);
  }
  state = newGame();
}
