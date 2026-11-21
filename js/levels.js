// Level definitions and AI difficulty curve (no scores or stars: win/lose only)

export const LEVELS_PER_MODE = 20;

export const MODES = {
  easy: {
    id: "easy",
    name: "EASY MODE",
    short: "Easy",
    description: "20 levels for beginners. The AI starts out clumsy and slowly sharpens up."
  },
  hard: {
    id: "hard",
    name: "HARD MODE",
    short: "Hard",
    description: "20 levels for experienced players. A sharper AI that rarely wastes a shot."
  }
};

// Overall difficulty 0..1.
// Easy: 0.00 -> 0.40.  Hard: 0.50 -> 1.00, so Hard 1 is always above Easy 20.
export function getDifficulty(mode, level) {
  const p = (level - 1) / (LEVELS_PER_MODE - 1);
  return mode === "hard" ? 0.5 + 0.5 * p : 0.4 * p;
}

const round = n => Math.round(n * 1000) / 1000;

// Difficulty keyframes at d = 0 (Easy 1), 0.4 (Easy 20), 0.5 (Hard 1), 1 (Hard 20)
const KEY_D = [0, 0.4, 0.5, 1];
const KEYS = {
  aimError:      [0.18, 0.085, 0.075, 0.062],  // +/- radians on the aim direction
  powerSkill:    [0.20, 0.65, 0.75, 0.90],     // 0 = original estimate, 1 = calibrated
  powerError:    [7.5, 4.2, 4.0, 3.4],         // +/- strength noise
  angleError:    [0.70, 0.45, 0.38, 0.28],     // +/- radians on the eraser's final angle
  mistakeChance: [0.28, 0.15, 0.13, 0.11]      // chance of a clearly bad shot
};

function interpolate(d, values) {
  for (let i = 1; i < KEY_D.length; i++) {
    if (d <= KEY_D[i]) {
      const t = (d - KEY_D[i - 1]) / (KEY_D[i] - KEY_D[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * t;
    }
  }
  return values[values.length - 1];
}

// Turns a difficulty value into parameters for the existing AI (see ai.js)
export function getAIParams(d) {
  const params = {};
  for (const name in KEYS) params[name] = round(interpolate(d, KEYS[name]));
  return params;
}

export function getLevelConfig(mode, level) {
  const difficulty = getDifficulty(mode, level);
  return { mode, level, difficulty, ai: getAIParams(difficulty) };
}

// Next level in the campaign, or null after Hard Level 20
export function getNextLevel(mode, level) {
  if (level < LEVELS_PER_MODE) return { mode, level: level + 1 };
  if (mode === "easy") return { mode: "hard", level: 1 };
  return null;
}