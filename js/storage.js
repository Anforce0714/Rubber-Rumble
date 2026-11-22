// Persistent save data (localStorage with an in-memory fallback)
import { calculateMatchReward, getLeague } from './economy.js';
import { getAITier, LEVELS_PER_MODE } from './levels.js';
import { DEFAULT_SKIN, getSkin, isValidSkin } from './skins.js';

// Same key as Phase 2 so existing progress is kept; new fields get safe defaults
const KEY = "rubberBattle.save.v1";
const MAX_CURRENCY = 1000000000;

const DEFAULT_SAVE = {
  version: 3,
  easyCompleted: 0,          // highest Easy level beaten (0-20)
  hardCompleted: 0,          // highest Hard level beaten (0-20)
  hardModeUnlocked: false,   // true after beating Easy Level 20
  trophies: 0,
  gold: 0,
  league: "Bronze",          // derived from trophies, stored for convenience
  ownedSkins: [DEFAULT_SKIN],
  equippedSkin: DEFAULT_SKIN,
  rewardedLevels: { easy: [], hard: [] },  // levels whose first-clear Gold was paid
  settings: { screenShake: true }
};

let cache = null;
const claimedMatches = new Set();   // match tokens already rewarded (this session)

function clampLevel(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(LEVELS_PER_MODE, n));
}

function clampCurrency(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_CURRENCY, n);
}

function cleanLevelList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    const n = Math.floor(Number(v));
    if (n >= 1 && n <= LEVELS_PER_MODE && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

function sanitize(raw) {
  raw = raw && typeof raw === "object" ? raw : {};

  const s = {
    version: DEFAULT_SAVE.version,
    easyCompleted: clampLevel(raw.easyCompleted),
    hardCompleted: clampLevel(raw.hardCompleted),
    hardModeUnlocked: !!raw.hardModeUnlocked,
    trophies: clampCurrency(raw.trophies),
    gold: clampCurrency(raw.gold),
    league: "Bronze",
    ownedSkins: [DEFAULT_SKIN],
    equippedSkin: DEFAULT_SKIN,
    rewardedLevels: {
      easy: cleanLevelList(raw.rewardedLevels && raw.rewardedLevels.easy),
      hard: cleanLevelList(raw.rewardedLevels && raw.rewardedLevels.hard)
    },
    settings: {
      screenShake: !(raw.settings && raw.settings.screenShake === false)
    }
  };

  // Skins: keep only valid, unique ids; the free skin is always owned
  if (Array.isArray(raw.ownedSkins)) {
    for (const id of raw.ownedSkins) {
      if (isValidSkin(id) && !s.ownedSkins.includes(id)) s.ownedSkins.push(id);
    }
  }
  if (isValidSkin(raw.equippedSkin) && s.ownedSkins.includes(raw.equippedSkin)) {
    s.equippedSkin = raw.equippedSkin;
  }

  // Hard Mode is unlocked by finishing Easy Level 20; Hard progress needs it
  if (s.easyCompleted >= LEVELS_PER_MODE) s.hardModeUnlocked = true;
  if (!s.hardModeUnlocked) s.hardCompleted = 0;

  s.league = getLeague(s.trophies).name;
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
  cache = sanitize(raw);
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    // storage blocked (private mode / quota): progress lasts for this session only
  }
}

// ---------- campaign progress ----------

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

// Updates progress in memory (no save). Returns what changed.
function applyCompletion(s, mode, level) {
  const result = { newlyUnlockedLevel: null, hardModeJustUnlocked: false };
  const key = mode === "hard" ? "hardCompleted" : "easyCompleted";

  if (level > s[key]) {
    s[key] = level;
    if (level < LEVELS_PER_MODE) result.newlyUnlockedLevel = level + 1;
  }

  if (mode === "easy" && level >= LEVELS_PER_MODE && !s.hardModeUnlocked) {
    s.hardModeUnlocked = true;
    result.hardModeJustUnlocked = true;
  }

  return result;
}

// Marks a level as beaten (no rewards). Kept for tools/tests; battles use recordMatch.
export function completeLevel(mode, level) {
  const s = load();
  if (!isLevelUnlocked(mode, level)) return { newlyUnlockedLevel: null, hardModeJustUnlocked: false };
  const result = applyCompletion(s, mode, level);
  save();
  return result;
}

// ---------- trophies & gold ----------

export function getGold() { return load().gold; }
export function getTrophies() { return load().trophies; }
export function getLeagueInfo() { return getLeague(load().trophies); }

// Records the result of ONE finished match: progress, trophies and Gold, saved
// together. `token` must be unique per match; the same token is rewarded only once.
// Returns a summary, or null if the match was already rewarded / is invalid.
export function recordMatch(token, mode, level, won) {
  if (!token || claimedMatches.has(token)) return null;
  if (mode !== "easy" && mode !== "hard") return null;
  if (!(level >= 1 && level <= LEVELS_PER_MODE)) return null;

  const s = load();
  if (won && !isLevelUnlocked(mode, level)) return null;

  claimedMatches.add(token);

  const tier = getAITier(mode, level);
  const trophiesBefore = s.trophies;
  const goldBefore = s.gold;
  const leagueBefore = getLeague(trophiesBefore);

  let progress = { newlyUnlockedLevel: null, hardModeJustUnlocked: false };
  let firstClear = false;

  if (won) {
    progress = applyCompletion(s, mode, level);

    const rewarded = s.rewardedLevels[mode];
    if (!rewarded.includes(level)) {
      rewarded.push(level);
      rewarded.sort((a, b) => a - b);
      firstClear = true;
    }
  }

  const reward = calculateMatchReward(tier, won, firstClear);

  s.trophies = Math.max(0, s.trophies + reward.trophies);   // never below zero
  s.gold = Math.min(MAX_CURRENCY, s.gold + reward.gold);
  s.league = getLeague(s.trophies).name;
  save();

  const leagueAfter = getLeague(s.trophies);

  return {
    won,
    tier,
    firstClear,
    trophyDelta: s.trophies - trophiesBefore,
    goldDelta: s.gold - goldBefore,
    breakdown: reward.breakdown,
    trophies: s.trophies,
    gold: s.gold,
    leagueBefore: leagueBefore.name,
    leagueAfter: leagueAfter.name,
    leagueChange: leagueAfter.index - leagueBefore.index,
    progress
  };
}

// ---------- skins ----------

export function getOwnedSkins() { return [...load().ownedSkins]; }
export function isSkinOwned(id) { return load().ownedSkins.includes(id); }
export function getEquippedSkinId() { return load().equippedSkin; }
export function getEquippedSkin() { return getSkin(load().equippedSkin); }

// Buys a skin with Gold. Returns { ok, reason?, missing? }
export function buySkin(id) {
  if (!isValidSkin(id)) return { ok: false, reason: "invalid" };

  const s = load();
  if (s.ownedSkins.includes(id)) return { ok: false, reason: "owned" };

  const price = getSkin(id).price;
  if (s.gold < price) return { ok: false, reason: "insufficient", missing: price - s.gold };

  s.gold -= price;
  s.ownedSkins.push(id);
  save();
  return { ok: true };
}

export function equipSkin(id) {
  if (!isValidSkin(id)) return { ok: false, reason: "invalid" };

  const s = load();
  if (!s.ownedSkins.includes(id)) return { ok: false, reason: "locked" };

  s.equippedSkin = id;
  save();
  return { ok: true };
}

// ---------- settings & reset ----------

export function getSettings() {
  return { ...load().settings };
}

export function setSetting(name, value) {
  load().settings[name] = value;
  save();
}

// Erases everything (progress, trophies, Gold, skins) but keeps settings
export function resetProgress() {
  cache = sanitize({ settings: load().settings });
  save();
}

// Used by tests: forget the cached copy so the next call re-reads localStorage
export function _reloadFromStorage() {
  cache = null;
}