import { COVER_TOLERANCE, ERASER, TABLE } from './constants.js';
import { S } from './state.js';
import { angleDifference, random } from './utils.js';
import { addParticle, createDust, createShockwave, createSparks, createTrail, flash, screenShake } from './vfx.js';

export function createEraser(x, y, color, side) {
  return {
    x, y, z: 0,
    vx: 0, vy: 0, vz: 0,
    angle: 0,
    color, side,
    airborne: false,
    stacked: false,
    squash: 0,
    stretch: 0
  };
}

// Get four corners
export function getCorners(e) {
  const halfL = ERASER.length / 2;
  const halfW = ERASER.width / 2;

  const local = [
    [-halfL, -halfW],
    [halfL, -halfW],
    [halfL, halfW],
    [-halfL, halfW]
  ];

  const cos = Math.cos(e.angle);
  const sin = Math.sin(e.angle);

  return local.map(([x, y]) => ({
    x: e.x + x * cos - y * sin,
    y: e.y + x * sin + y * cos
  }));
}

// Cover check
export function fullyCovers(top, bottom) {
  const distance = Math.hypot(top.x - bottom.x, top.y - bottom.y);

  if (distance > COVER_TOLERANCE.position) return false;

  if (angleDifference(top.angle, bottom.angle) > COVER_TOLERANCE.angle) {
    return false;
  }

  const corners = getCorners(bottom);
  const cos = Math.cos(top.angle);
  const sin = Math.sin(top.angle);

  return corners.every(point => {
    const px = point.x - top.x;
    const py = point.y - top.y;

    const localX = px * cos + py * sin;
    const localY = -px * sin + py * cos;

    return (
      Math.abs(localX) <= ERASER.length / 2 + COVER_TOLERANCE.corner &&
      Math.abs(localY) <= ERASER.width / 2 + COVER_TOLERANCE.corner
    );
  });
}

// Landing check
export function checkLanding(eraser) {
  const target = eraser.side === "player" ? S.ai : S.player;

  if (target.stacked) return false;

  if (fullyCovers(eraser, target)) {
    eraser.stacked = true;
    target.stacked = true;

    // Top eraser rises, bottom stays on table
    target.z = 0;
    eraser.z = ERASER.height;

    S.winner = eraser.side;
    return true;
  }

  return false;
}

// Flight physics
export function updateFlight(e, dt) {
  const step = dt / 16.67;

  e.x += e.vx * step;
  e.y += e.vy * step;

  // Flight trail (every frame)
  createTrail(e);

  // Mid-air sparks
  if (Math.random() < 0.35) {
    addParticle(e.x, e.y - e.z, e.color, {
      vx: random(-0.5, 0.5),
      vy: random(-0.5, 0.5),
      gravity: 0,
      size: random(1.5, 3),
      decay: 0.06,
      glow: true
    });
  }

  e.z += e.vz * step;
  e.vz -= 0.24 * step;

  e.vx *= Math.pow(0.992, step);
  e.vy *= Math.pow(0.992, step);

  // Table boundary collision & bounce
  const marginX = ERASER.length / 2;
  const marginY = ERASER.width / 2;
  const bounceDamping = 0.72;
  let hitWall = false;

  if (e.x < TABLE.left + marginX) {
    e.x = TABLE.left + marginX;
    e.vx = Math.abs(e.vx) * bounceDamping;
    hitWall = true;
  } else if (e.x > TABLE.right - marginX) {
    e.x = TABLE.right - marginX;
    e.vx = -Math.abs(e.vx) * bounceDamping;
    hitWall = true;
  }

  if (e.y < TABLE.top + marginY) {
    e.y = TABLE.top + marginY;
    e.vy = Math.abs(e.vy) * bounceDamping;
    hitWall = true;
  } else if (e.y > TABLE.bottom - marginY) {
    e.y = TABLE.bottom - marginY;
    e.vy = -Math.abs(e.vy) * bounceDamping;
    hitWall = true;
  }

  if (hitWall) {
    e.angle = Math.atan2(e.vy, e.vx);
    e.squash = 0.25;
    createSparks(e.x, e.y - e.z, "#ffe082", 8);
    createShockwave(e.x, e.y - e.z, "rgba(255,255,255,0.6)", 45);
    screenShake(3, 100);
  }

  // Landing
  if (e.z <= 0 && e.vz < 0) {
    e.z = 0;
    e.vz = 0;
    e.vx = 0;
    e.vy = 0;
    e.airborne = false;
    S.moving = false;

    createDust(e.x, e.y, "rgba(255,255,255,0.8)");
    createSparks(e.x, e.y, "#ffe082", 10);
    createShockwave(e.x, e.y, "#ffffff", 85);
    screenShake(5, 180);
    flash("#ffffff", 0.5);
    e.squash = 0.35;

    return true; // landed: caller (game.js) resolves the landing
  }

  return false;
}