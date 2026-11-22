import { ERASER, H, TABLE, VFX, W } from './constants.js';
import { ctx } from './dom.js';
import { S } from './state.js';
import { random } from './utils.js';

export function addParticle(x, y, color, o = {}) {
  if (S.particles.length >= VFX.maxParticles) S.particles.shift();

  const p = {
    x, y,
    vx: o.vx ?? random(-2, 2),
    vy: o.vy ?? random(-2, 2),
    size: o.size ?? random(2, 5),
    life: 1,
    decay: o.decay ?? random(0.018, 0.035),
    color,
    gravity: o.gravity ?? 0.035,
    shape: o.shape || "circle", // circle | spark | confetti
    rot: random(0, Math.PI * 2),
    vr: random(-0.3, 0.3),
    glow: o.glow ?? false
  };
  S.particles.push(p);
  return p;
}

// Landing dust (spreading outward)
export function createDust(x, y, color) {
  for (let i = 0; i < 18; i++) {
    const a = random(0, Math.PI * 2);
    const s = random(0.5, 3);
    addParticle(x, y, color, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s * 0.6,
      gravity: -0.01,
      size: random(3, 7),
      decay: random(0.02, 0.04)
    });
  }
}

// Sparks
export function createSparks(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const a = random(0, Math.PI * 2);
    const s = random(2, 7);
    addParticle(x, y, color, {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      gravity: 0.08,
      size: random(1.5, 3),
      decay: random(0.03, 0.06),
      shape: "spark",
      glow: true
    });
  }
}

// Victory: burst + confetti
export function createVictoryParticles(x, y) {
  const colors = ["#ffd54f", "#ffffff", "#ffae42", "#8ce5ff", "#ff7b7b", "#9dff9d"];

  for (let i = 0; i < 90; i++) {
    const a = random(0, Math.PI * 2);
    const s = random(1, 7);
    addParticle(x, y, colors[(Math.random() * colors.length) | 0], {
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 2,
      size: random(2, 6),
      decay: random(0.008, 0.018),
      gravity: 0.045,
      glow: true
    });
  }

  for (let i = 0; i < 70; i++) {
    addParticle(random(TABLE.left, TABLE.right), TABLE.top - random(0, 60),
      colors[(Math.random() * colors.length) | 0], {
        vx: random(-1, 1),
        vy: random(1, 3),
        size: random(4, 8),
        decay: random(0.004, 0.009),
        gravity: 0.03,
        shape: "confetti"
      });
  }
}

// Flight trail
export function createTrail(e) {
  S.trails.push({
    x: e.x,
    y: e.y - e.z,
    angle: e.angle,
    color: e.color,
    size: random(5, 10),
    life: 1
  });
  if (S.trails.length > 60) S.trails.shift();
}

// Shockwave
export function createShockwave(x, y, color, maxRadius = 75, delay = 0) {
  S.shockwaves.push({ x, y, radius: 5, maxRadius, life: 1, color, delay });
}

export function screenShake(pwr = 5, duration = 220) {
  if (!S.settings.screenShake) return;
  if (pwr < S.screenShakePower && S.screenShakeTime > 0) return;
  S.screenShakePower = pwr;
  S.screenShakeTime = duration;
  S.screenShakeTotal = duration;
}

export function flash(color = "#ffffff", amount = 1) {
  S.flashColor = color;
  S.landingFlash = amount;
}

export function addFloatText(x, y, text, color = "#ffffff", size = 26) {
  S.floatTexts.push({ x, y, text, color, size, life: 1 });
}

// Charging: energy gathers toward the eraser
export function chargeEffect(e, pw) {
  const a = random(0, Math.PI * 2);
  const d = random(50, 85);
  const px = e.x + Math.cos(a) * d;
  const py = e.y + Math.sin(a) * d * 0.7;

  addParticle(px, py, pw > 80 ? "#ff8a65" : "#8ce5ff", {
    vx: (e.x - px) * 0.06,
    vy: (e.y - py) * 0.06,
    gravity: 0,
    size: random(2, 4),
    decay: 0.05,
    glow: true
  });
}

// Ambient dust motes
export function initMotes() {
  S.motes = [];
  for (let i = 0; i < 30; i++) {
    S.motes.push({
      x: random(0, W),
      y: random(0, H),
      vx: random(-0.1, 0.1),
      vy: random(-0.15, -0.02),
      size: random(1, 2.5),
      alpha: random(0.1, 0.3)
    });
  }
}

export function updateVFX(dt) {
  const step = Math.min(dt / 16.67, 2);

  S.particles.forEach(p => {
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.vy += p.gravity * step;
    p.vx *= Math.pow(0.98, step);
    p.rot += p.vr * step;
    p.life -= p.decay * step;
  });
  S.particles = S.particles.filter(p => p.life > 0);

  S.trails.forEach(t => (t.life -= 0.06 * step));
  S.trails = S.trails.filter(t => t.life > 0);

  S.shockwaves.forEach(s => {
    if (s.delay > 0) {
      s.delay -= dt;
      return;
    }
    s.radius += (s.maxRadius - s.radius) * 0.12 * step + 1.5 * step;
    s.life -= 0.04 * step;
  });
  S.shockwaves = S.shockwaves.filter(s => s.life > 0);

  S.floatTexts.forEach(t => {
    t.y -= 0.8 * step;
    t.life -= 0.02 * step;
  });
  S.floatTexts = S.floatTexts.filter(t => t.life > 0);

  S.motes.forEach(m => {
    m.x += m.vx * step;
    m.y += m.vy * step;
    if (m.y < -5) m.y = H + 5;
    if (m.x < -5) m.x = W + 5;
    if (m.x > W + 5) m.x = -5;
  });

  S.screenShakeTime = Math.max(0, S.screenShakeTime - dt);
  if (S.screenShakeTime <= 0) S.screenShakePower = 0;

  S.landingFlash = Math.max(0, S.landingFlash - 0.06 * step);
  S.zoom += (1 - S.zoom) * 0.04 * step;

  [S.player, S.ai].forEach(e => {
    e.squash = Math.max(0, e.squash - 0.04 * step);
    e.stretch = Math.max(0, e.stretch - 0.05 * step);
  });
}

export function drawMotes() {
  ctx.save();
  ctx.fillStyle = "#fff";
  S.motes.forEach(m => {
    ctx.globalAlpha = m.alpha;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function drawTrails() {
  S.trails.forEach(t => {
    ctx.save();
    ctx.globalAlpha = t.life * 0.3;
    ctx.fillStyle = t.color;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    const k = t.life;
    ctx.fillRect(
      -ERASER.length / 2 * k, -ERASER.width / 2 * k,
      ERASER.length * k, ERASER.width * k
    );
    ctx.restore();
  });
}

// Speed lines
export function drawSpeedLines(e) {
  if (!e.airborne) return;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp < 3) return;

  const ang = Math.atan2(e.vy, e.vx) + Math.PI;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const off = random(-ERASER.width / 2, ERASER.width / 2);
    const len = random(20, 55) * Math.min(sp / 6, 1.5);
    const sx = e.x + Math.cos(ang + Math.PI / 2) * off;
    const sy = e.y - e.z + Math.sin(ang + Math.PI / 2) * off;
    ctx.globalAlpha = random(0.2, 0.6);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles() {
  S.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    if (p.glow) ctx.globalCompositeOperation = "lighter";

    if (p.shape === "spark") {
      ctx.lineWidth = p.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
      ctx.stroke();
    } else if (p.shape === "confetti") {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.abs(Math.sin(p.rot * 1.5)) + 0.2);
      ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

export function drawShockwaves() {
  S.shockwaves.forEach(s => {
    if (s.delay > 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = s.life * 0.8;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4 * s.life;
    ctx.beginPath();
    // Ellipse matching table perspective
    ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

export function drawFloatTexts() {
  S.floatTexts.forEach(t => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life * 1.5);
    ctx.font = `bold ${t.size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  });
}

export function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawLandingFlash() {
  if (S.landingFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = S.landingFlash * 0.25;
  ctx.fillStyle = S.flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Charge aura
export function drawChargeAura() {
  if (!S.charging || S.turn !== "player") return;

  const t = performance.now() / 120;
  const r = 50 + S.power * 0.25 + Math.sin(t) * 3;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(S.player.x, S.player.y, 10, S.player.x, S.player.y, r);
  const hot = S.power > 80 ? "255,120,80" : "100,200,255";
  g.addColorStop(0, `rgba(${hot},${0.15 + S.power / 300})`);
  g.addColorStop(1, `rgba(${hot},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(S.player.x, S.player.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}