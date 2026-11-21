// Persistent save data (localStorage with an in-memory fallback)
import { LEVELS_PER_MODE } from './levels.js';

const KEY = "rubberBattle.save.v1";

const DEFAULT_SAVE = {
  easyCompleted: 0,          // highest Easy level beaten (0-20)
  hardCompleted: 0,          // highest Hard level beaten (0-20)
  hardModeUnlocked: false,   // true after beating Easy Level 20
  settings: { screenShake: true }
};

let cache = null;

function clampLevel(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(LEVELS_PER_MODE, n));
}

function sanitize(raw) {
  const s = {
    easyCompleted: clampLevel(raw && raw.easyCompleted),
    hardCompleted: clampLevel(raw && raw.hardCompleted),
    hardModeUnlocked: !!(raw && raw.hardModeUnlocked),
    settings: {
      screenShake: !(raw && raw.settings && raw.settings.screenShake === false)
    }
  };
  // Hard Mode is unlocked by finishing Easy Level 20; Hard progress needs it
  if (s.easyCompleted >= LEVELS_PER_MODE) s.hardModeUnlocked = true;
  if (!s.hardModeUnlocked) s.hardCompleted = 0;
  return s;
}

function load() {
  if (cache) return cache;
  let raw = null;
  try {
    const text = localStorage.getItem(KEY);
    if (text) raw = JSON.parse(text);
  } catch (e) {
    raw = null; // corrupted data or storage unavailable
  }
  cache = sanitize(raw || DEFAULT_SAVE);
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    // storage blocked (private mode / quota): progress lasts for this session only
  }
}

export function getCompleted(mode) {
  const s = load();
  return mode === "hard" ? s.hardCompleted : s.easyCompleted;
}

export function isHardModeUnlocked() {
  return load().hardModeUnlocked;
}

export function isModeUnlocked(mode) {
  return mode === "hard" ? isHardModeUnlocked() : true;
}

// Highest level the player may start in a mode (0 if the mode is locked)
export function getUnlockedLevel(mode) {
  if (!isModeUnlocked(mode)) return 0;
  return Math.min(LEVELS_PER_MODE, getCompleted(mode) + 1);
}

export function isLevelUnlocked(mode, level) {
  return level >= 1 && level <= getUnlockedLevel(mode);
}

export function isLevelCompleted(mode, level) {
  return level >= 1 && level <= getCompleted(mode);
}

// Call when the player wins. Returns what changed.
export function completeLevel(mode, level) {
  const s = load();
  const result = { newlyUnlockedLevel: null, hardModeJustUnlocked: false };

  if (!isLevelUnlocked(mode, level)) return result;

  const key = mode === "hard" ? "hardCompleted" : "easyCompleted";

  if (level > s[key]) {
    s[key] = level;
    if (level < LEVELS_PER_MODE) result.newlyUnlockedLevel = level + 1;
  }

  if (mode === "easy" && level >= LEVELS_PER_MODE && !s.hardModeUnlocked) {
    s.hardModeUnlocked = true;
    result.hardModeJustUnlocked = true;
  }

  save();
  return result;
}

export function getSettings() {
  return { ...load().settings };
}

export function setSetting(name, value) {
  load().settings[name] = value;
  save();
}

export function resetProgress() {
  cache = sanitize({ ...DEFAULT_SAVE, settings: load().settings });
  save();
}

// Used by tests: forget the cached copy so the next call re-reads localStorage
export function _reloadFromStorage() {
  cache = null;
}