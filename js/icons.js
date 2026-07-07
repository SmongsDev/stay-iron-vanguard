// icons.js — 프로시저럴 캐릭터 아이콘 (단일 책임: 인라인 SVG 생성)
// 외부 요청 0. nikkeIcon(id) → 결정적 SVG 문자열 (ROSTER 정적 값만 사용)
'use strict';

const ICON = (function () {
  // 등급 테두리색 (style.css --r/--sr/--ssr 와 동일 값)
  const RARITY = { R: '#6fb2ff', SR: '#b98cff', SSR: '#ffc44d' };
  // 진영 배경색: 오리온=시안 / 헬릭스=마젠타 / 테라=그린 / 노마드=앰버
  const FACTION = { '오리온': '#22e0e0', '헬릭스': '#ff3bd4', '테라': '#35e07a', '노마드': '#ffb23b' };
  let _uid = 0;

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t)); };

  // 무기 글리프 6종 — 우하단 배지(중심 78,78) 위 흰 도형 직접 드로잉
  function glyph(w) {
    switch (w) {
      case 'AR':  return '<rect x="66" y="75" width="24" height="5"/><rect x="86" y="80" width="4" height="6"/>';
      case 'SMG': return '<rect x="68" y="74" width="16" height="5"/><rect x="70" y="79" width="5" height="7"/>';
      case 'SR':  return '<rect x="64" y="77" width="26" height="3"/><circle cx="73" cy="78" r="4" fill="none" stroke="#fff" stroke-width="2"/>';
      case 'RL':  return '<rect x="68" y="74" width="20" height="7" rx="3"/><path d="M66 77 L60 73 L60 81 Z"/>';
      case 'MG':  return '<rect x="66" y="74" width="22" height="5"/><circle cx="70" cy="84" r="1.6"/><circle cx="75" cy="84" r="1.6"/><circle cx="80" cy="84" r="1.6"/>';
      case 'SG':  return '<rect x="66" y="74" width="24" height="4"/><rect x="66" y="80" width="24" height="4"/>';
      default:    return '';
    }
  }

  // 실사 아트 보유 캐릭터 (img/{id}.png 128px). 미보유는 프로시저럴 SVG 폴백
  const ART = new Set(['ignis', 'carmine', 'nova', 'aria', 'lumen', 'ceres', 'undine', 'vera', 'prism']);

  function nikkeIcon(id) {
    const b = ROSTER_MAP[id];
    if (!b) return '';
    if (ART.has(id)) {
      return '<img class="nk-svg nk-img r-' + b.rarity + '" src="img/' + id + '.png" alt="' + b.name + '">';
    }
    const h = hash(id);
    const border = RARITY[b.rarity] || '#888';
    const fac = FACTION[b.corp] || '#22e0e0';
    const angle = h % 360;                 // 그라데이션 각도 변주
    const light = 0.15 + (h % 30) / 100;   // 명도 변주 (동일 진영끼리 구분)
    const c1 = mix(fac, '#ffffff', light);
    const c2 = mix(fac, '#0a0e17', 0.55);
    const gid = 'nkg' + (_uid++);          // 그라데이션 id 충돌 방지
    const ch = b.name.charAt(0) || '?';
    return '<svg viewBox="0 0 100 100" class="nk-svg">'
      + '<defs><linearGradient id="' + gid + '" gradientTransform="rotate(' + angle + ' .5 .5)">'
      + '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>'
      + '<rect x="5" y="5" width="90" height="90" rx="16" fill="url(#' + gid + ')"/>'
      + '<rect x="5" y="5" width="90" height="90" rx="16" fill="none" stroke="' + border + '" stroke-width="5"/>'
      + '<text x="50" y="59" text-anchor="middle" font-size="44" font-weight="800" fill="#fff" fill-opacity="0.92" font-family="sans-serif">' + ch + '</text>'
      + '<circle cx="78" cy="79" r="18" fill="#0a0e17" fill-opacity="0.55"/>'
      + '<g fill="#fff">' + glyph(b.weapon) + '</g>'
      + '</svg>';
  }

  return { nikkeIcon };
})();

const nikkeIcon = ICON.nikkeIcon;
