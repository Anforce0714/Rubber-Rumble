import { W, H } from './constants.js';

// Shared mutable game state (ES module bindings can't be reassigned across modules)
export const S = {
  player: undefined,
  ai: undefined,
  turn: "player",
  direction: 0,
  power: 0,

  charging: false,
  chargeStart: 0,
  aiming: false,

  moving: false,
  gameOver: false,
  lastTime: 0,

  aiTimer: null,
  activeEraser: null,
  winner: null,

  // VFX state
  particles: [],
  trails: [],
  shockwaves: [],
  floatTexts: [],
  motes: [],

  screenShakePower: 0,
  screenShakeTime: 0,
  screenShakeTotal: 1,

  landingFlash: 0,
  flashColor: "#ffffff",
  zoom: 1,                       // Victory camera zoom
  zoomCenter: { x: W / 2, y: H / 2 },
  slowMoTime: 0,                 // Remaining slow-motion time (ms)
  chargeFx: 0,                   // Charge effect timer

  // Campaign / menu state
  mode: null,                    // "easy" | "hard"
  level: 0,                      // 1..20
  levelConfig: null,             // { mode, level, difficulty, ai }
  inBattle: false,
  loopRunning: false,
  resultTimer: null,
  matchToken: null,              // unique id of the current match (reward guard)
  shots: { player: 0, ai: 0 },    // shots taken this match
  bestMiss: { player: Infinity, ai: Infinity },  // closest landing to the rival eraser
  settings: { screenShake: true, sound: true }
};