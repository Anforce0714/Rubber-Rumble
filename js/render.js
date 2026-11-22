import { ERASER, H, TABLE, W } from './constants.js';
import { ctx } from './dom.js';
import { S } from './state.js';
import { random } from './utils.js';
import { drawChargeAura, drawFloatTexts, drawLandingFlash, drawMotes, drawParticles, drawShockwaves, drawSpeedLines, drawTrails, drawVignette } from './vfx.js';

export function drawTable() {
  ctx.fillStyle = "#b77b47";
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0
      ? "rgba(85,45,18,0.10)"
      : "rgba(255,210,140,0.09)";
    ctx.fillRect(0, i * 45, W, 22);
  }

  // Outer wooden rail base
  ctx.fillStyle = "#5c351e";
  ctx.fillRect(
    TABLE.left - 18, TABLE.top - 18,
    TABLE.right - TABLE.left + 36,
    TABLE.bottom - TABLE.top + 36
  );

  // Rail bevel highlight
  ctx.strokeStyle = "#8f5938";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    TABLE.left - 16, TABLE.top - 16,
    TABLE.right - TABLE.left + 32,
    TABLE.bottom - TABLE.top + 32
  );

  // Table surface
  ctx.fillStyle = "#d7a16b";
  ctx.fillRect(
    TABLE.left, TABLE.top,
    TABLE.right - TABLE.left,
    TABLE.bottom - TABLE.top
  );

  // Inner rail shadow for depth
  ctx.strokeStyle = "rgba(45, 22, 10, 0.45)";
  ctx.lineWidth = 5;
  ctx.strokeRect(
    TABLE.left + 2, TABLE.top + 2,
    TABLE.right - TABLE.left - 4,
    TABLE.bottom - TABLE.top - 4
  );
}

export function drawEraser(e) {
  ctx.save();

  const visualY = e.y - e.z;
  const base = Math.max(0, e.z - (e.stacked ? ERASER.height : 0));

  // Shadow: fainter and larger with height
  ctx.save();
  ctx.translate(e.x + 5 + base * 0.12, e.y + 7 + base * 0.12);
  ctx.rotate(e.angle);
  ctx.globalAlpha = Math.max(0.08, 0.25 - base * 0.0015);
  ctx.fillStyle = "#000";
  const sc = 1 + base * 0.004;
  ctx.scale(sc, sc);
  ctx.fillRect(-ERASER.length / 2, -ERASER.width / 2, ERASER.length, ERASER.width);
  ctx.restore();

  ctx.translate(e.x, visualY);
  ctx.rotate(e.angle);

  // Squash and stretch
  const sx = 1 + e.stretch * 0.5 + e.squash * 0.25;
  const sy = 1 - e.stretch * 0.1 - e.squash * 0.35;
  ctx.scale(sx, sy);

  // Side thickness
  ctx.fillStyle = "#686868";
  ctx.fillRect(
    -ERASER.length / 2, -ERASER.width / 2 + ERASER.height,
    ERASER.length, ERASER.width
  );

  // Top body
  const gradient = ctx.createLinearGradient(0, -ERASER.width / 2, 0, ERASER.width / 2);
  // Cosmetic skin colours (default: classic blue)
  gradient.addColorStop(0, e.light || "#a9dcff");
  gradient.addColorStop(1, e.dark || "#348bd2");

  ctx.fillStyle = gradient;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(-ERASER.length / 2, -ERASER.width / 2, ERASER.length, ERASER.width, 5);
  } else {
    ctx.rect(-ERASER.length / 2, -ERASER.width / 2, ERASER.length, ERASER.width);
  }
  ctx.fill();

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(-ERASER.length / 2 + 8, -ERASER.width / 2 + 4, ERASER.length - 16, 3);

  // Winner glow
  if (e.stacked && e.side === S.winner) {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,213,79,${0.5 + Math.sin(performance.now() / 150) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(-ERASER.length / 2, -ERASER.width / 2, ERASER.length, ERASER.width);
  }

  ctx.restore();
}

// Player direction arrow (lengthens and changes color while charging)
export function drawArrow() {
  if (S.turn !== "player" || S.moving || S.gameOver) return;

  const x = S.player.x;
  const y = S.player.y;
  const length = 85 + S.power * 0.9;

  const endX = x + Math.cos(S.direction) * length;
  const endY = y + Math.sin(S.direction) * length;

  const color = S.power > 80 ? "#ff8a65" : S.power > 40 ? "#ffd54f" : "#ffffff";

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -performance.now() / 40;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.translate(endX, endY);
  ctx.rotate(S.direction);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-14, -9);
  ctx.lineTo(-14, 9);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Target indicator ring (pulsing animation)
export function drawTarget() {
  if (S.gameOver || S.moving) return;

  const target = S.turn === "player" ? S.ai : S.player;
  const pulse = Math.sin(performance.now() / 250) * 4;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = performance.now() / 60;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(target.x, target.y, 55 + pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();

  // Camera: shake + zoom
  if (S.screenShakeTime > 0) {
    const k = S.screenShakePower * (S.screenShakeTime / S.screenShakeTotal);
    ctx.translate(random(-k, k), random(-k, k));
  }
  if (S.zoom !== 1) {
    ctx.translate(S.zoomCenter.x, S.zoomCenter.y);
    ctx.scale(S.zoom, S.zoom);
    ctx.translate(-S.zoomCenter.x, -S.zoomCenter.y);
  }

  drawTable();
  drawMotes();
  drawTarget();
  drawTrails();
  drawChargeAura();

  // Layering: higher z on top; winner on top if equal z
  const order = [S.player, S.ai].sort((a, b) =>
    a.z - b.z || (a.side === S.winner ? 1 : 0) - (b.side === S.winner ? 1 : 0)
  );
  order.forEach(drawEraser);

  drawSpeedLines(S.player);
  drawSpeedLines(S.ai);
  drawArrow();
  drawShockwaves();
  drawParticles();
  drawFloatTexts();

  ctx.restore();

  drawVignette();
  drawLandingFlash();
}