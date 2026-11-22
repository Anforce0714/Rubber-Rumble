import { S } from './state.js';
import { random } from './utils.js';

// Default parameters = the original AI exactly (no errors, original power estimate)
export const DEFAULT_AI_PARAMS = {
  aimError: 0,
  powerSkill: 0,
  powerError: 0,
  angleError: 0,
  mistakeChance: 0
};

// Predicted travel distance of a shot (ignores walls). Mirrors launch() speed
// formulas and the flight constants in updateFlight() (gravity 0.24, drag 0.992).
function flightDistance(strength) {
  let speed = 2.5 + strength * 0.085;
  let vz = 2.5 + strength * 0.075;
  let z = 0;
  let dist = 0;

  for (let i = 0; i < 400; i++) {
    dist += speed;
    z += vz;
    vz -= 0.24;
    speed *= 0.992;
    if (z <= 0 && vz < 0) break;
  }

  return dist;
}

// Strength needed to land `distance` away
export function estimateStrength(distance) {
  let lo = 10;
  let hi = 100;

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (flightDistance(mid) < distance) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}

// AI attack
export function aiTurn(launch, params = DEFAULT_AI_PARAMS) {
  if (S.gameOver || S.moving) return;

  const dx = S.player.x - S.ai.x;
  const dy = S.player.y - S.ai.y;
  const distance = Math.hypot(dx, dy);

  let attackAngle = Math.atan2(dy, dx);
  let desiredAngle = S.player.angle;

  let strength = 55 + distance * 0.035;
  strength = Math.max(55, Math.min(100, strength));

  // --- difficulty adjustments (all skipped with DEFAULT_AI_PARAMS) ---

  // Power estimation: blend the original estimate toward a calibrated one
  if (params.powerSkill > 0) {
    strength += (estimateStrength(distance) - strength) * params.powerSkill;
  }

  // Aiming accuracy, power noise and angle-matching accuracy
  if (params.aimError > 0) attackAngle += random(-params.aimError, params.aimError);
  if (params.powerError > 0) strength += random(-params.powerError, params.powerError);
  if (params.angleError > 0) desiredAngle += random(-params.angleError, params.angleError);

  // Decision-making: occasionally commit to a clearly bad shot
  if (params.mistakeChance > 0 && Math.random() < params.mistakeChance) {
    if (Math.random() < 0.5) {
      attackAngle += random(0.25, 0.7) * (Math.random() < 0.5 ? -1 : 1);
    } else {
      strength *= random(0.6, 1.4);
    }
  }

  if (params.powerSkill > 0 || params.powerError > 0 || params.mistakeChance > 0) {
    strength = Math.max(10, Math.min(100, strength));
  }

  launch(S.ai, attackAngle, strength, desiredAngle);
}