// ads.js — 광고 어댑터 계층 (단일 책임: 광고 SDK 추상화)
// 게임 로직은 Ads.* 인터페이스만 호출. SDK 직접 호출 금지.
'use strict';

const Ads = (function () {
  // 어댑터 선택: ?ads=mock|crazygames|none, 없으면 crazygames.com 호스트 자동감지, 기본 mock
  function pickMode() {
    let q = '';
    try { q = new URLSearchParams(location.search).get('ads') || ''; } catch (e) { q = ''; }
    if (q === 'mock' || q === 'crazygames' || q === 'none') return q;
    if (typeof location !== 'undefined' && /(^|\.)crazygames\.com$/.test(location.hostname)) return 'crazygames';
    return 'mock';
  }

  const mode = pickMode();

  // 오버레이 컨테이너 확보 (내용은 호출마다 새로 채움)
  function ensureOverlay() {
    let o = document.getElementById('ad-overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'ad-overlay';
      o.className = 'ad-overlay hidden';
      document.body.appendChild(o);
    }
    return o;
  }

  // ── mock 어댑터: 카운트다운/전면 오버레이 (외부 요청 0) ──
  const mockAdapter = {
    init() {},
    showRewarded(onReward, onFail) {
      const overlay = ensureOverlay();
      overlay.innerHTML =
        '<div class="ad-box"><div class="ad-tag">광고 (데모)</div>' +
        '<div id="ad-count" class="ad-count">3</div>' +
        '<div class="ad-msg">보상형 광고 시청 중…</div>' +
        '<button id="ad-cancel" class="ad-cancel">건너뛰기 (보상 없음)</button></div>';
      overlay.classList.remove('hidden');
      const countEl = overlay.querySelector('#ad-count');
      const cancelBtn = overlay.querySelector('#ad-cancel');
      let remain = 3, done = false;
      const finish = (rewarded) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        overlay.classList.add('hidden');
        cancelBtn.onclick = null;
        if (rewarded) onReward && onReward(); else onFail && onFail('cancelled');
      };
      const timer = setInterval(() => {
        remain -= 1;
        if (remain <= 0) { finish(true); return; }
        countEl.textContent = String(remain);
      }, 1000);
      cancelBtn.onclick = () => finish(false); // 취소 시 보상 없음
    },
    showMidgame(onDone) {
      const overlay = ensureOverlay();
      overlay.innerHTML =
        '<div class="ad-box"><div class="ad-tag">광고 (데모)</div>' +
        '<div class="ad-msg">잠시 후 계속…</div></div>';
      overlay.classList.remove('hidden');
      setTimeout(() => { overlay.classList.add('hidden'); onDone && onDone(); }, 1500);
    },
    showBanner() { setBanner(true); },
    hideBanner() { setBanner(false); },
    gameplayStart() {},
    gameplayStop() {},
  };

  // ── crazygames 어댑터: 공식 HTML5 SDK v3 ──
  // v3는 사용 전 SDK.init() 완료가 필수 (미완료 시 SDK 사용 불가)
  // API: window.CrazyGames.SDK.ad.requestAd("rewarded", {adStarted, adFinished, adError})
  //      window.CrazyGames.SDK.game.gameplayStart()/gameplayStop()/loadingStart()/loadingStop()
  const crazyAdapter = {
    _ready: false,
    init() {
      // SDK 스크립트는 이 어댑터 활성 시에만 동적 로드
      const s = document.createElement('script');
      s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
      s.async = true;
      s.onload = () => {
        window.CrazyGames.SDK.init().then(() => {
          this._ready = true;
          // 정적 게임이라 로딩 즉시 완료 → 곧바로 게임플레이 시작 이벤트
          safeGame('loadingStart');
          safeGame('loadingStop');
          safeGame('gameplayStart');
        }).catch((e) => console.warn('[Ads] CrazyGames SDK init 실패:', e));
      };
      s.onerror = () => console.warn('[Ads] CrazyGames SDK 로드 실패');
      document.head.appendChild(s);
      setBanner(false); // 배너는 포털이 자체 운영 → 게임 내 비활성
    },
    showRewarded(onReward, onFail) {
      const sdk = window.CrazyGames && window.CrazyGames.SDK;
      if (!this._ready || !sdk || !sdk.ad) { onFail && onFail('sdk-not-ready'); return; }
      sdk.ad.requestAd('rewarded', {
        adStarted: () => {},
        adFinished: () => { onReward && onReward(); },
        adError: (err) => { onFail && onFail(err); },
      });
    },
    showMidgame(onDone) {
      const sdk = window.CrazyGames && window.CrazyGames.SDK;
      if (!this._ready || !sdk || !sdk.ad) { onDone && onDone(); return; }
      // 미드게임: 보상 없음. finished/error 모두 onDone (SDK가 3분 캡 자동 관리)
      sdk.ad.requestAd('midgame', {
        adStarted: () => {},
        adFinished: () => { onDone && onDone(); },
        adError: () => { onDone && onDone(); },
      });
    },
    showBanner() {},           // 포털 운영 배너
    hideBanner() { setBanner(false); },
    gameplayStart() { safeGame('gameplayStart'); },
    gameplayStop() { safeGame('gameplayStop'); },
  };

  function safeGame(fn) {
    try {
      const g = window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game;
      if (g && typeof g[fn] === 'function') g[fn]();
    } catch (e) { console.warn('[Ads] game.' + fn + ' 실패:', e); }
  }

  // ── none 어댑터: 광고 없음 ──
  const noneAdapter = {
    init() { setBanner(false); },
    showRewarded(onReward, onFail) { onFail && onFail('ads-disabled'); },
    showMidgame(onDone) { onDone && onDone(); },  // 즉시 통과
    showBanner() {},
    hideBanner() { setBanner(false); },
    gameplayStart() {},
    gameplayStop() {},
  };

  // 배너 슬롯 표시/숨김 (mock만 플레이스홀더)
  function setBanner(show) {
    const slot = document.getElementById('banner-slot');
    if (!slot) return;
    slot.classList.toggle('hidden', !show);
    if (show && !slot.textContent) slot.textContent = '광고 배너 320×50 (데모)';
  }

  const adapter = mode === 'crazygames' ? crazyAdapter : mode === 'none' ? noneAdapter : mockAdapter;

  // 광고 정책: 광고 시작 시 게임 일시정지 + gameplayStop, 종료(보상/실패/취소) 시 재개 + gameplayStart
  function beginAd() {
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} // 정지 중 저장 틱 멈춤 대비 1회 저장
    if (typeof pauseLoop === 'function') pauseLoop();
    adapter.gameplayStop();
  }
  function endAd() {
    if (typeof resumeLoop === 'function') resumeLoop();
    adapter.gameplayStart();
  }

  return {
    mode,
    hasAds: mode !== 'none',
    init() { adapter.init(); if (mode === 'mock') adapter.showBanner(); },
    showRewarded(onReward, onFail) {
      beginAd();
      adapter.showRewarded(
        () => { endAd(); onReward && onReward(); },
        (r) => { endAd(); onFail && onFail(r); }
      );
    },
    showMidgame(onDone) {
      beginAd();
      adapter.showMidgame(() => { endAd(); onDone && onDone(); });
    },
    showBanner() { adapter.showBanner(); },
    hideBanner() { adapter.hideBanner(); },
    gameplayStart() { adapter.gameplayStart(); },
    gameplayStop() { adapter.gameplayStop(); },
  };
})();
