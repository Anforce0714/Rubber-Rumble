// Random starting positions for the player and AI erasers
import { ERASER, TABLE } from './constants.js';
import { random } from './utils.js';

// Keep the whole eraser on the table, whatever its rotation
const EDGE = ERASER.length / 2 + 20;

// Distance between the two erasers at the start of a match
const MIN_DISTANCE = 200;   // never touching
const MAX_DISTANCE = 600;   // still reachable with a full-power shot

const FALLBACK = {
  player: { x: 300, y: 280, angle: 0 },
  ai: { x: 610, y: 280, angle: 0 }
};

function randomPoint() {
  return {
    x: random(TABLE.left + EDGE, TABLE.right - EDGE),
    y: random(TABLE.top + EDGE, TABLE.bottom - EDGE)
  };
}

// Returns { player: {x, y, angle}, ai: {x, y, angle} }
// Positions are random anywhere on the table, and each eraser starts with its own
// random rotation.
export function getRandomSpawn() {
  for (let i = 0; i < 100; i++) {
    const player = randomPoint();
    const ai = randomPoint();
    const distance = Math.hypot(ai.x - player.x, ai.y - player.y);

    if (distance >= MIN_DISTANCE && distance <= MAX_DISTANCE) {
      player.angle = random(-Math.PI, Math.PI);
      ai.angle = random(-Math.PI, Math.PI);
      return { player, ai };
    }
  }

  return FALLBACK;
}