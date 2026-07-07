// ui.js — 렌더링, 탭, 숫자 포맷 (단일 책임: DOM 표현)
'use strict';

// 숫자 포맷 K/M/B/T…
function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
  let i = -1;
  let v = n;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + u[i];
}

const el = (id) => document.getElementById(id);

// 갱신 최적화용 더티 플래그 (매 틱 전체 DOM 재생성 금지)
let _rosterDirty = true;
let _outpostDirty = true;
let _activeTab = 'combat';

function markRosterDirty() { _rosterDirty = true; }
function markOutpostDirty() { _outpostDirty = true; }

// ── 초기화 ────────────────────────────────────────────────
function initUI() {
  // 탭 전환 (이벤트 위임)
  el('tabnav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // 아스트라 로스터 (이벤트 위임 — 개별 리스너 다발 금지)
  el('roster-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    onRosterAction(btn.dataset.action, btn.dataset.id);
  });

  // 모집
  el('pull1-btn').addEventListener('click', () => doPull(1));
  el('pull10-btn').addEventListener('click', () => doPull(10));

  // 전투: 보스 재도전 직후 미드게임 광고 (자연 전환점)
  el('retry-btn').addEventListener('click', () => { retryBoss(); Ads.showMidgame(); });

  // 전초기지 / 설정
  el('outpost-upgrade-btn').addEventListener('click', () => {
    if (upgradeOutpost()) { markOutpostDirty(); markRosterDirty(); }
  });
  el('reset-btn').addEventListener('click', onResetClick);
  // 복귀 정산 수령 직후 미드게임 광고 (자연 전환점)
  el('return-close').addEventListener('click', () => { el('return-modal').classList.add('hidden'); Ads.showMidgame(); });

  // 보상형 광고 배치 3종
  el('ad-boost-btn').addEventListener('click', onAdBoost);
  el('ad-gem-btn').addEventListener('click', onAdGems);
  el('ad-double-btn').addEventListener('click', onAdDouble);
  if (!Ads.hasAds) {              // none 모드: 광고 버튼 숨김
    el('ad-boost-btn').classList.add('hidden');
    el('ad-gem-btn').classList.add('hidden');
  }

  buildBurstDots();
  renderRoster();
  renderOutpost();
  el('gacha-rates').textContent =
    `SSR ${CONST.RATES.SSR * 100}% · SR ${CONST.RATES.SR * 100}% · R ${CONST.RATES.R * 100}%  (1회 ${CONST.PULL_COST} · 10연 ${CONST.TEN_PULL_COST} 젬)`;
  switchTab('combat');
  updateUI();
}

function switchTab(tab) {
  _activeTab = tab;
  for (const t of ['combat', 'nikke', 'gacha', 'outpost']) {
    el('tab-' + t).classList.toggle('hidden', t !== tab);
    const nav = document.querySelector(`[data-tab="${t}"]`);
    if (nav) nav.classList.toggle('active', t === tab);
  }
  if (tab === 'nikke') renderRoster();
  if (tab === 'outpost') renderOutpost();
}

// ── 매 틱 갱신 ────────────────────────────────────────────
function updateUI() {
  el('credits').textContent = fmt(state.credits);
  el('gems').textContent = fmt(state.gems);

  if (_activeTab === 'combat') updateCombat();
  if (_activeTab === 'nikke') {
    if (_rosterDirty || _tickCount % 4 === 0) renderRoster();
  }
  if (_activeTab === 'outpost') {
    if (_outpostDirty || _tickCount % 4 === 0) renderOutpost();
  }
}

// ── 전투 탭 (직접 갱신) ───────────────────────────────────
function updateCombat() {
  el('stage-label').textContent = stageLabel(activeStageIndex());
  const hpPct = rt.enemyMaxHp > 0 ? Math.max(0, rt.enemyHp) / rt.enemyMaxHp * 100 : 0;
  el('enemy-hp-fill').style.width = hpPct + '%';
  el('enemy-hp-text').textContent = fmt(Math.max(0, rt.enemyHp)) + ' / ' + fmt(rt.enemyMaxHp);
  el('total-dps').textContent = 'DPS ' + fmt(teamDPS() * boostMult());

  // 보스 배지 / 타이머
  el('boss-badge').classList.toggle('hidden', !rt.boss);
  const timerEl = el('boss-timer');
  if (rt.boss) {
    timerEl.classList.remove('hidden');
    timerEl.textContent = '⏱ ' + Math.ceil(rt.bossTimerMs / 1000) + 's';
  } else {
    timerEl.classList.add('hidden');
  }

  // 버스트
  el('burst-fill').style.width = (rt.burst / CONST.BURST_MAX * 100) + '%';
  el('burst-fill').classList.toggle('full', rt.burstActive);
  const can = teamCanFullBurst();
  el('burst-status').textContent = rt.burstActive
    ? `풀 오버드라이브! ×${CONST.BURST_MULT} (${Math.ceil(rt.burstTimerMs / 1000)}s)`
    : can ? '오버드라이브 충전 중' : '편성에 I·II·III 필요';
  const dots = document.querySelectorAll('#burst-dots .burst-dot');
  const present = burstTypesPresent();
  dots.forEach((d) => {
    const t = Number(d.dataset.type);
    d.classList.toggle('lit', present[t]);
    d.classList.toggle('firing', rt.burstActive && present[t]);
  });
  if (rt.burstJustTriggered) {
    rt.burstJustTriggered = false;
    el('burst-bar').classList.remove('flash');
    void el('burst-bar').offsetWidth; // reflow로 애니메이션 재시작
    el('burst-bar').classList.add('flash');
  }

  // DPS 부스트 상태
  const bs = el('boost-status');
  if (boostActive()) {
    bs.classList.remove('hidden');
    bs.textContent = `⚡ DPS ×${CONST.AD_BOOST_MULT} 부스트 ${fmtTime(state.boostUntil - Date.now())} 남음`;
  } else {
    bs.classList.add('hidden');
  }

  // 파밍 / 재도전
  el('retry-btn').classList.toggle('hidden', !rt.farming);
  el('farming-note').classList.toggle('hidden', !rt.farming);
  if (rt.farming) {
    el('farming-note').textContent = `보스 ${stageLabel(rt.blockedBoss)} 시간 초과 — ${stageLabel(activeStageIndex())} 파밍 중`;
  }

  renderTeamSlots();
}

function burstTypesPresent() {
  const p = { 1: false, 2: false, 3: false };
  for (const id of state.team) { const b = ROSTER_MAP[id]; if (b) p[b.burst] = true; }
  return p;
}

function buildBurstDots() {
  el('burst-dots').innerHTML = [1, 2, 3]
    .map((t) => `<span class="burst-dot" data-type="${t}">${['', 'I', 'II', 'III'][t]}</span>`)
    .join('');
}

function renderTeamSlots() {
  const slots = [];
  for (let i = 0; i < CONST.TEAM_SIZE; i++) {
    const id = state.team[i];
    if (id) {
      const b = ROSTER_MAP[id];
      slots.push(`<div class="slot r-${b.rarity}"><div class="slot-icon">${nikkeIcon(id)}</div><span class="slot-name">${b.name}</span><span class="slot-sub">${b.rarity}·B${b.burst}·Lv${state.nikkes[id].level}</span></div>`);
    } else {
      slots.push('<div class="slot empty">빈 슬롯</div>');
    }
  }
  el('team-slots').innerHTML = slots.join('');
}

// ── 아스트라 탭 ───────────────────────────────────────────
function renderRoster() {
  _rosterDirty = false;
  const owned = ROSTER.filter((n) => isOwned(n.id));
  const rows = owned.map((n) => {
    const ns = state.nikkes[n.id];
    const cost = levelUpCost(ns.level);
    const inTeam = state.team.includes(n.id);
    const atk = nikkeAtk(n.id);
    const canLevel = state.credits >= cost;
    return `<div class="nikke r-${n.rarity}">
      <div class="nk-icon">${nikkeIcon(n.id)}</div>
      <div class="nk-body">
      <div class="nikke-head"><span class="nk-name">${n.name}</span>
        <span class="badge b-${n.rarity}">${n.rarity}</span>
        <span class="badge b-burst">B${n.burst}</span>
        <span class="nk-meta">${n.weapon}·${n.corp}</span></div>
      <div class="nikke-stats">Lv ${ns.level} · 코어 ${ns.core}/${CONST.MAX_CORE} · ATK ${fmt(atk)}</div>
      <div class="nikke-actions">
        <button data-action="level" data-id="${n.id}" class="${canLevel ? '' : 'dim'}">레벨업 (${fmt(cost)})</button>
        <button data-action="team" data-id="${n.id}" class="${inTeam ? 'on' : ''}">${inTeam ? '편성 해제' : '편성'}</button>
      </div></div></div>`;
  });
  el('roster-list').innerHTML = rows.join('') || '<p class="muted">보유 아스트라 없음</p>';
}

function onRosterAction(action, id) {
  if (action === 'level') {
    const ns = state.nikkes[id];
    const cost = levelUpCost(ns.level);
    if (state.credits < cost) { flash('크레딧이 부족합니다.'); return; }
    state.credits -= cost;
    ns.level += 1;
    markRosterDirty();
  } else if (action === 'team') {
    const i = state.team.indexOf(id);
    if (i >= 0) state.team.splice(i, 1);
    else if (state.team.length < CONST.TEAM_SIZE) state.team.push(id);
    else { flash('편성은 최대 5명입니다.'); return; }
    markRosterDirty();
  }
  renderRoster();
}

// ── 모집 탭 ───────────────────────────────────────────────
function doPull(count) {
  const res = pull(count);
  if (!res.ok) { flash(res.reason); return; }
  markRosterDirty();
  const cards = res.results.map((r) => {
    const tag = r.maxed ? `만돌파→+${fmt(r.refund)}크레딧` : r.dup ? '코어 +1' : 'NEW';
    return `<div class="pull-card r-${r.rarity}"><div class="pc-icon">${nikkeIcon(r.id)}</div><span class="pc-r">${r.rarity}</span><span class="pc-n">${r.name}</span><span class="pc-t">${tag}</span></div>`;
  });
  el('gacha-result').innerHTML = cards.join('');
}

// ── 전초기지 탭 ───────────────────────────────────────────
function renderOutpost() {
  _outpostDirty = false;
  el('outpost-level').textContent = state.outpostLevel;
  el('outpost-rate').textContent = fmt(outpostRate(state.outpostLevel)) + ' /초';
  const cost = outpostUpgradeCost(state.outpostLevel);
  const btn = el('outpost-upgrade-btn');
  btn.textContent = `레벨업 (${fmt(cost)} 크레딧)`;
  btn.classList.toggle('dim', state.credits < cost);

  // 무료 젬 광고 쿨다운
  const gemBtn = el('ad-gem-btn');
  const now = Date.now();
  if (now < state.adGemReadyAt) {
    gemBtn.classList.add('dim');
    gemBtn.textContent = `쿨다운 ${fmtTime(state.adGemReadyAt - now)}`;
  } else {
    gemBtn.classList.remove('dim');
    gemBtn.textContent = `📺 광고 보고 젬 ${CONST.AD_GEM_REWARD} 획득`;
  }
}

// ── 설정: 리셋 2단 확인 ───────────────────────────────────
let _resetArmed = false;
function onResetClick() {
  const btn = el('reset-btn');
  if (!_resetArmed) {
    _resetArmed = true;
    btn.textContent = '정말 초기화? 다시 누르면 삭제';
    btn.classList.add('danger');
    setTimeout(() => {
      _resetArmed = false;
      btn.textContent = '데이터 초기화';
      btn.classList.remove('danger');
    }, 4000);
    return;
  }
  resetGame();
  resetCombatRuntime();
  markRosterDirty();
  markOutpostDirty();
  _resetArmed = false;
  btn.textContent = '데이터 초기화';
  btn.classList.remove('danger');
  switchTab('combat');
}

// ── 보상형 광고 핸들러 3종 ────────────────────────────────
function onAdBoost() {
  Ads.showRewarded(() => {
    const base = Math.max(Date.now(), state.boostUntil || 0); // 활성 중이면 연장
    state.boostUntil = base + CONST.AD_BOOST_DURATION_MS;
    flash(`DPS ×${CONST.AD_BOOST_MULT} 부스트 활성!`);
  }, () => flash('광고 시청이 취소되었습니다.'));
}

function onAdGems() {
  if (Date.now() < state.adGemReadyAt) { flash('아직 쿨다운 중입니다.'); return; }
  Ads.showRewarded(() => {
    state.gems += CONST.AD_GEM_REWARD;
    state.adGemReadyAt = Date.now() + CONST.AD_GEM_COOLDOWN_MS;
    markOutpostDirty();
    flash(`젬 +${CONST.AD_GEM_REWARD} 획득!`);
  }, () => flash('광고 시청이 취소되었습니다.'));
}

let _pendingOffline = null; // { credits, gems, claimed }
function onAdDouble() {
  if (!_pendingOffline || _pendingOffline.claimed) return;
  Ads.showRewarded(() => {
    state.credits += _pendingOffline.credits; // 1배 추가 지급
    state.gems += _pendingOffline.gems;
    _pendingOffline.claimed = true;
    el('ad-double-btn').classList.add('hidden');
    flash('2배 수령 완료!');
  }, () => flash('광고 시청이 취소되었습니다.'));
}

// ── 복귀 모달 / 토스트 ────────────────────────────────────
function showReturnModal(off) {
  const hrs = (off.ms / 3600000);
  el('return-body').innerHTML =
    `<p>방치 시간 <b>${hrs.toFixed(1)}시간</b>${off.capped ? ' (12h 상한 적용)' : ''}</p>
     <p class="reward-line">💰 크레딧 <b>+${fmt(off.credits)}</b></p>
     <p class="reward-line">💎 젬 <b>+${fmt(off.gems)}</b></p>`;
  _pendingOffline = { credits: off.credits, gems: off.gems, claimed: false };
  const dbl = el('ad-double-btn');
  dbl.classList.toggle('hidden', !Ads.hasAds); // none 모드면 숨김
  el('return-modal').classList.remove('hidden');
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

let _toastTimer = null;
function flash(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
}
