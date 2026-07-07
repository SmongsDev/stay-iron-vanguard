// main.js — 초기화, 게임 루프(250ms 틱) (단일 책임: 오케스트레이션)
'use strict';

let _tickCount = 0;
let _loopHandle = null;

function gameTick() {
  const dt = CONST.TICK_MS;
  combatTick(dt);
  outpostTick(dt);          // idle.js: 전초기지 초당 크레딧

  _tickCount += 1;
  if (_tickCount % CONST.AUTOSAVE_TICKS === 0) saveGame();

  if (typeof updateUI === 'function') updateUI();
}

function startLoop() {
  if (_loopHandle) return;
  _loopHandle = setInterval(gameTick, CONST.TICK_MS);
  Ads.gameplayStart();      // 전투 루프 시작 = gameplay 시작
}

// 광고 중 게임 일시정지/재개 (ads.js가 호출). 중복 호출 안전.
function pauseLoop() {
  if (!_loopHandle) return;
  clearInterval(_loopHandle);
  _loopHandle = null;
}
function resumeLoop() {
  if (_loopHandle) return;
  _loopHandle = setInterval(gameTick, CONST.TICK_MS);
}

function init() {
  Ads.init();                       // ads.js: 어댑터 선택 + (필요 시) SDK 동적 로드
  const load = loadGame();          // state.js
  initStage();                      // combat.js

  // 오프라인 정산 (신규 게임 제외)
  let offline = null;
  if (!load.fresh && load.elapsedMs > 0) {
    offline = settleOffline(load.elapsedMs); // idle.js
  }

  if (typeof initUI === 'function') initUI(); // ui.js: DOM 캐시, 이벤트 위임, 최초 렌더
  if (offline && typeof showReturnModal === 'function') showReturnModal(offline);

  startLoop();

  // beforeunload 저장 (조용한 실패 금지 — saveGame 내부에서 경고)
  window.addEventListener('beforeunload', () => { saveGame(); Ads.gameplayStop(); });
}

// DOM 준비 후 시작
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
