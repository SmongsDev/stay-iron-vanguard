// data.js — 아스트라 로스터, 상수, 밸런스 테이블 (단일 책임: 정적 데이터)
'use strict';

// 전역 상수 / 밸런스 테이블
const CONST = {
  SAVE_KEY: 'stay_iron_vanguard',
  SAVE_VERSION: 2,
  TICK_MS: 250,
  AUTOSAVE_TICKS: 20,        // 20틱 × 250ms = 5초
  // 가차
  PULL_COST: 300,
  TEN_PULL_COST: 2700,
  RATES: { SSR: 0.04, SR: 0.43, R: 0.53 },
  MAX_CORE: 3,
  CORE_REFUND: 500,         // 만돌파 중복 시 크레딧 환급
  // 성장
  BASE_ATK: { R: 10, SR: 18, SSR: 32 },
  LEVEL_COST_BASE: 50,
  LEVEL_COST_GROWTH: 1.12,
  ATK_PER_LEVEL: 0.1,
  ATK_PER_CORE: 0.3,
  // 전투
  ENEMY_HP_BASE: 100,
  ENEMY_HP_GROWTH: 1.18,
  STAGES_PER_CHAPTER: 10,
  BOSS_EVERY: 5,
  BOSS_HP_MULT: 5,
  BOSS_REWARD_MULT: 5,
  BOSS_TIME_LIMIT_MS: 30000,
  CREDIT_PER_KILL_BASE: 6,
  CREDIT_KILL_GROWTH: 1.16,
  GEM_PER_KILL: 1,
  GEM_PER_BOSS: 20,
  TEAM_SIZE: 5,
  // 오버드라이브 (내부 식별자는 burst 유지)
  BURST_MAX: 100,
  BURST_CHARGE_PER_TICK: 2.5,
  BURST_CHARGE_PER_KILL: 18,
  BURST_MULT: 2.5,
  BURST_DURATION_MS: 10000,
  // 방치 / 전초기지
  OFFLINE_CAP_MS: 12 * 3600 * 1000,
  OFFLINE_KILLS_PER_SEC: 0.5,
  OUTPOST_RATE_BASE: 2,
  OUTPOST_RATE_GROWTH: 1.25,
  OUTPOST_COST_BASE: 150,
  OUTPOST_COST_GROWTH: 1.35,
  // 광고 수익화 (v2)
  AD_GEM_REWARD: 150,
  AD_GEM_COOLDOWN_MS: 15 * 60 * 1000,
  AD_BOOST_MULT: 2,
  AD_BOOST_DURATION_MS: 30 * 60 * 1000,
};

// 아스트라 로스터 (20명, 오리지널 IP). baseAtk 는 등급 기준 ±20% 변주 개체값.
// burst: 1/2/3, weapon: 플레이버, 진영: 오리온/헬릭스/테라/노마드
const ROSTER = [
  // SSR (9)
  { id: 'ignis',   name: '이그니스', rarity: 'SSR', burst: 3, weapon: 'SG', corp: '오리온', baseAtk: 38 },
  { id: 'carmine', name: '카르민',   rarity: 'SSR', burst: 3, weapon: 'AR', corp: '노마드', baseAtk: 36 },
  { id: 'nova',    name: '노바',     rarity: 'SSR', burst: 3, weapon: 'MG', corp: '노마드', baseAtk: 37 },
  { id: 'aria',    name: '아리아',   rarity: 'SSR', burst: 1, weapon: 'RL', corp: '오리온', baseAtk: 30 },
  { id: 'lumen',   name: '루멘',     rarity: 'SSR', burst: 2, weapon: 'SR', corp: '오리온', baseAtk: 33 },
  { id: 'ceres',   name: '세레스',   rarity: 'SSR', burst: 2, weapon: 'AR', corp: '노마드', baseAtk: 28 },
  { id: 'undine',  name: '운디네',   rarity: 'SSR', burst: 1, weapon: 'SG', corp: '오리온', baseAtk: 26 },
  { id: 'vera',    name: '벨라',     rarity: 'SSR', burst: 3, weapon: 'MG', corp: '테라',   baseAtk: 34 },
  { id: 'prism',   name: '프리즘',   rarity: 'SSR', burst: 1, weapon: 'SR', corp: '헬릭스', baseAtk: 31 },
  // SR (6)
  { id: 'yuna',    name: '유나',     rarity: 'SR', burst: 3, weapon: 'AR', corp: '오리온', baseAtk: 20 },
  { id: 'mir',     name: '미르',     rarity: 'SR', burst: 2, weapon: 'SMG', corp: '오리온', baseAtk: 17 },
  { id: 'liv',     name: '리브',     rarity: 'SR', burst: 1, weapon: 'SG', corp: '테라',   baseAtk: 19 },
  { id: 'ten',     name: '텐',       rarity: 'SR', burst: 2, weapon: 'SMG', corp: '헬릭스', baseAtk: 15 },
  { id: 'volt',    name: '볼트',     rarity: 'SR', burst: 3, weapon: 'MG', corp: '테라',   baseAtk: 21 },
  { id: 'sera',    name: '새라',     rarity: 'SR', burst: 1, weapon: 'SR', corp: '헬릭스', baseAtk: 18 },
  // R (5)
  { id: 'hana',    name: '하나',     rarity: 'R', burst: 1, weapon: 'SG', corp: '오리온', baseAtk: 11 },
  { id: 'pico',    name: '피코',     rarity: 'R', burst: 2, weapon: 'SMG', corp: '테라',   baseAtk: 9 },
  { id: 'roka',    name: '로카',     rarity: 'R', burst: 3, weapon: 'RL', corp: '헬릭스', baseAtk: 12 },
  { id: 'tsuki',   name: '츠키',     rarity: 'R', burst: 2, weapon: 'SMG', corp: '오리온', baseAtk: 10 },
  { id: 'zero',    name: '제로',     rarity: 'R', burst: 3, weapon: 'AR', corp: '테라',   baseAtk: 8 },
];

// 빠른 조회용 맵
const ROSTER_MAP = ROSTER.reduce((m, n) => { m[n.id] = n; return m; }, {});

// 시작 지급 구성: 유나(SR,III), 미르(SR,II), 하나(R,I)
const STARTER = [
  { id: 'yuna', core: 0 },
  { id: 'mir', core: 0 },
  { id: 'hana', core: 0 },
];
