const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status");
const instruction = document.getElementById("instruction");
const launchButton = document.getElementById("launch");
const powerFill = document.getElementById("powerFill");
const powerText = document.getElementById("powerText");

const result = document.getElementById("result");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

const W = 900;
const H = 560;

const TABLE = { left: 55, right: 845, top: 45, bottom: 515 };
const ERASER = { length: 92, width: 43, height: 12 };

// Cover tolerance parameters
const COVER_TOLERANCE = {
  position: 25,
  angle: 25 * Math.PI / 180,
  corner: 20
};

let player, ai;
let turn = "player";
let direction = 0;
let power = 0;

let charging = false;
let chargeStart = 0;
let aiming = false;

let moving = false;
let gameOver = false;
let lastTime = 0;

let aiTimer = null;
let activeEraser = null;
let winner = null;

// =========================
// VFX STATE
// =========================

let particles = [];
let trails = [];
let shockwaves = [];
let floatTexts = [];
let motes = [];

let screenShakePower = 0;
let screenShakeTime = 0;
let screenShakeTotal = 1;

let landingFlash = 0;
let flashColor = "#ffffff";
let zoom = 1;          // Victory camera zoom
let zoomCenter = { x: W / 2, y: H / 2 };
let slowMoTime = 0;    // Remaining slow-motion time (ms)
let chargeFx = 0;      // Charge effect timer

const VFX = { maxParticles: 320 };

function random(min, max) {
  return min + Math.random() * (max - min);
}

function createEraser(x, y, color, side) {
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

// =========================
// PARTICLES
// =========================

function addParticle(x, y, color, o = {}) {
  if (particles.length >= VFX.maxParticles) particles.shift();

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
  particles.push(p);
  return p;
}

// Landing dust (spreading outward)
function createDust(x, y, color) {
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
function createSparks(x, y, color, count = 16) {
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
function createVictoryParticles(x, y) {
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
function createTrail(e) {
  trails.push({
    x: e.x,
    y: e.y - e.z,
    angle: e.angle,
    color: e.color,
    size: random(5, 10),
    life: 1
  });
  if (trails.length > 60) trails.shift();
}

// Shockwave
function createShockwave(x, y, color, maxRadius = 75, delay = 0) {
  shockwaves.push({ x, y, radius: 5, maxRadius, life: 1, color, delay });
}

function screenShake(power = 5, duration = 220) {
  if (power < screenShakePower && screenShakeTime > 0) return;
  screenShakePower = power;
  screenShakeTime = duration;
  screenShakeTotal = duration;
}

function flash(color = "#ffffff", amount = 1) {
  flashColor = color;
  landingFlash = amount;
}

function addFloatText(x, y, text, color = "#ffffff", size = 26) {
  floatTexts.push({ x, y, text, color, size, life: 1 });
}

// Charging: energy gathers toward the eraser
function chargeEffect(e, power) {
  const a = random(0, Math.PI * 2);
  const d = random(50, 85);
  const px = e.x + Math.cos(a) * d;
  const py = e.y + Math.sin(a) * d * 0.7;

  addParticle(px, py, power > 80 ? "#ff8a65" : "#8ce5ff", {
    vx: (e.x - px) * 0.06,
    vy: (e.y - py) * 0.06,
    gravity: 0,
    size: random(2, 4),
    decay: 0.05,
    glow: true
  });
}

// Ambient dust motes
function initMotes() {
  motes = [];
  for (let i = 0; i < 30; i++) {
    motes.push({
      x: random(0, W),
      y: random(0, H),
      vx: random(-0.1, 0.1),
      vy: random(-0.15, -0.02),
      size: random(1, 2.5),
      alpha: random(0.1, 0.3)
    });
  }
}

// =========================
// VFX UPDATE
// =========================

function updateVFX(dt) {
  const step = Math.min(dt / 16.67, 2);

  particles.forEach(p => {
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.vy += p.gravity * step;
    p.vx *= Math.pow(0.98, step);
    p.rot += p.vr * step;
    p.life -= p.decay * step;
  });
  particles = particles.filter(p => p.life > 0);

  trails.forEach(t => (t.life -= 0.06 * step));
  trails = trails.filter(t => t.life > 0);

  shockwaves.forEach(s => {
    if (s.delay > 0) {
      s.delay -= dt;
      return;
    }
    s.radius += (s.maxRadius - s.radius) * 0.12 * step + 1.5 * step;
    s.life -= 0.04 * step;
  });
  shockwaves = shockwaves.filter(s => s.life > 0);

  floatTexts.forEach(t => {
    t.y -= 0.8 * step;
    t.life -= 0.02 * step;
  });
  floatTexts = floatTexts.filter(t => t.life > 0);

  motes.forEach(m => {
    m.x += m.vx * step;
    m.y += m.vy * step;
    if (m.y < -5) m.y = H + 5;
    if (m.x < -5) m.x = W + 5;
    if (m.x > W + 5) m.x = -5;
  });

  screenShakeTime = Math.max(0, screenShakeTime - dt);
  if (screenShakeTime <= 0) screenShakePower = 0;

  landingFlash = Math.max(0, landingFlash - 0.06 * step);
  zoom += (1 - zoom) * 0.04 * step;

  [player, ai].forEach(e => {
    e.squash = Math.max(0, e.squash - 0.04 * step);
    e.stretch = Math.max(0, e.stretch - 0.05 * step);
  });
}

// =========================
// VFX DRAW
// =========================

function drawMotes() {
  ctx.save();
  ctx.fillStyle = "#fff";
  motes.forEach(m => {
    ctx.globalAlpha = m.alpha;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawTrails() {
  trails.forEach(t => {
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
function drawSpeedLines(e) {
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

function drawParticles() {
  particles.forEach(p => {
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

function drawShockwaves() {
  shockwaves.forEach(s => {
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

function drawFloatTexts() {
  floatTexts.forEach(t => {
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

function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawLandingFlash() {
  if (landingFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = landingFlash * 0.25;
  ctx.fillStyle = flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Charge aura
function drawChargeAura() {
  if (!charging || turn !== "player") return;

  const t = performance.now() / 120;
  const r = 50 + power * 0.25 + Math.sin(t) * 3;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, r);
  const hot = power > 80 ? "255,120,80" : "100,200,255";
  g.addColorStop(0, `rgba(${hot},${0.15 + power / 300})`);
  g.addColorStop(1, `rgba(${hot},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =========================
// GAME FLOW
// =========================

function resetGame() {
  clearTimeout(aiTimer);

  player = createEraser(300, 280, "#4ba8f5", "player");
  ai = createEraser(610, 280, "#ef6666", "ai");

  turn = "player";
  direction = Math.atan2(ai.y - player.y, ai.x - player.x);
  power = 0;

  charging = false;
  aiming = false;
  moving = false;
  gameOver = false;

  activeEraser = null;
  winner = null;

  particles = [];
  trails = [];
  shockwaves = [];
  floatTexts = [];
  screenShakeTime = 0;
  screenShakePower = 0;
  landingFlash = 0;
  zoom = 1;
  slowMoTime = 0;

  result.classList.add("hidden");
  launchButton.disabled = false;
  launchButton.classList.remove("charging");

  statusText.textContent = "Player's Turn: Choose Direction";
  instruction.textContent = "Click the table to choose launch direction";

  updatePower();
  draw();
}

function updatePower() {
  powerFill.style.width = power + "%";
  powerText.textContent = Math.round(power) + "%";
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * W / rect.width,
    y: (event.clientY - rect.top) * H / rect.height
  };
}

function setDirectionFromPointer(event) {
  const pos = getPointerPosition(event);
  direction = Math.atan2(pos.y - player.y, pos.x - player.x);
}

// Player chooses direction (supports drag-to-aim)
canvas.addEventListener("pointerdown", event => {
  if (turn !== "player") return;
  if (moving || charging || gameOver) return;

  aiming = true;
  setDirectionFromPointer(event);
  instruction.textContent = "Direction set — ready to charge";
});

canvas.addEventListener("pointermove", event => {
  if (!aiming || turn !== "player" || moving || charging || gameOver) return;
  setDirectionFromPointer(event);
});

window.addEventListener("pointerup", () => (aiming = false));

// Start charging
launchButton.addEventListener("pointerdown", event => {
  if (turn !== "player") return;
  if (moving || gameOver || launchButton.disabled) return;

  event.preventDefault();

  charging = true;
  chargeStart = performance.now();
  launchButton.classList.add("charging");
});

// Release power
function releasePower() {
  if (!charging) return;

  charging = false;
  launchButton.classList.remove("charging");

  if (turn !== "player" || gameOver) return;

  const finalPower = Math.max(10, power);

  power = 0;
  updatePower();

  launch(player, direction, finalPower);
}

launchButton.addEventListener("pointerup", releasePower);
launchButton.addEventListener("pointercancel", releasePower);
window.addEventListener("pointerup", releasePower);

// Launch eraser
function launch(eraser, angle, strength, targetAngle = angle) {
  if (moving || gameOver) return;

  activeEraser = eraser;
  moving = true;

  const speed = 2.5 + strength * 0.085;

  eraser.vx = Math.cos(angle) * speed;
  eraser.vy = Math.sin(angle) * speed;
  eraser.vz = 2.5 + strength * 0.075;

  eraser.angle = targetAngle;
  eraser.airborne = true;
  eraser.stacked = false;

  eraser.squash = 0.25;
  eraser.stretch = 0.4;

  // Launch VFX: shockwave + sparks + dust
  createShockwave(eraser.x, eraser.y, eraser.color, 60 + strength * 0.4);
  createSparks(eraser.x, eraser.y, eraser.color, 8 + Math.round(strength / 8));
  createDust(eraser.x, eraser.y, "rgba(255,255,255,0.6)");
  screenShake(2 + strength / 40, 120);

  if (strength > 85) {
    addFloatText(eraser.x, eraser.y - 40, "POWER!", "#ffb74d", 28);
    flash("#ffcc80", 0.4);
  }

  statusText.textContent =
    eraser.side === "player" ? "Player is attacking!" : "AI is attacking you!";
  instruction.textContent = "Eraser is in flight...";

  launchButton.disabled = true;
}

// Get four corners
function getCorners(e) {
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

// Angle difference (a rectangle looks identical after rotating 180°, so modulo PI)
function angleDifference(a, b) {
  let diff = Math.abs(a - b) % Math.PI;
  return Math.min(diff, Math.PI - diff);
}

// Cover check
function fullyCovers(top, bottom) {
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
function checkLanding(eraser) {
  const target = eraser.side === "player" ? ai : player;

  if (target.stacked) return false;

  if (fullyCovers(eraser, target)) {
    eraser.stacked = true;
    target.stacked = true;

    // Top eraser rises, bottom stays on table
    target.z = 0;
    eraser.z = ERASER.height;

    winner = eraser.side;
    endGame(winner);
    return true;
  }

  return false;
}

// Game over
function endGame(side) {
  if (gameOver) return;

  gameOver = true;
  moving = false;
  charging = false;
  launchButton.classList.remove("charging");

  const winningEraser = side === "player" ? player : ai;

  createVictoryParticles(winningEraser.x, winningEraser.y);

  // Triple golden shockwaves
  createShockwave(winningEraser.x, winningEraser.y, "#ffd54f", 140, 0);
  createShockwave(winningEraser.x, winningEraser.y, "#ffffff", 180, 120);
  createShockwave(winningEraser.x, winningEraser.y, "#ffd54f", 220, 240);

  addFloatText(winningEraser.x, winningEraser.y - 60, "COVER!", "#ffd54f", 40);

  flash("#fff3c4", 1);
  screenShake(9, 350);

  // Slow motion + camera zoom
  slowMoTime = 700;
  zoom = 1.08;
  zoomCenter = { x: winningEraser.x, y: winningEraser.y };

  launchButton.disabled = true;

  // Delay result modal so VFX plays first
  setTimeout(() => {
    if (!gameOver) return;
    result.classList.remove("hidden");
  }, 900);

  if (side === "player") {
    resultTitle.textContent = "🏆 Player Wins!";
    resultText.textContent = "You covered the AI's eraser with yours!";
    statusText.textContent = "Player covered the target!";
  } else {
    resultTitle.textContent = "AI Wins!";
    resultText.textContent = "The AI covered your eraser with theirs!";
    statusText.textContent = "AI covered the target!";
  }
}

// Flight physics
function updateFlight(e, dt) {
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
    moving = false;

    createDust(e.x, e.y, "rgba(255,255,255,0.8)");
    createSparks(e.x, e.y, "#ffe082", 10);
    createShockwave(e.x, e.y, "#ffffff", 85);
    screenShake(5, 180);
    flash("#ffffff", 0.5);
    e.squash = 0.35;

    const success = checkLanding(e);

    if (!success) {
      addFloatText(e.x, e.y - 50, "MISS", "#b0bec5", 24);
      nextTurn();
    }
  }
}

// Next turn
function nextTurn() {
  if (gameOver) return;

  if (turn === "player") {
    turn = "ai";
    statusText.textContent = "AI is aiming at you...";
    instruction.textContent = "AI is preparing an attack";
    aiTimer = setTimeout(aiTurn, 800);
  } else {
    turn = "player";
    statusText.textContent = "Player's Turn: Choose Direction";
    instruction.textContent = "Click the table to choose launch direction";
    launchButton.disabled = false;
  }
}

// AI attack
function aiTurn() {
  if (gameOver || moving) return;

  const dx = player.x - ai.x;
  const dy = player.y - ai.y;
  const distance = Math.hypot(dx, dy);

  const attackAngle = Math.atan2(dy, dx);
  const desiredAngle = player.angle;

  let strength = 55 + distance * 0.035;
  strength = Math.max(55, Math.min(100, strength));

  launch(ai, attackAngle, strength, desiredAngle);
}

// =========================
// DRAWING
// =========================

function drawTable() {
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

function drawEraser(e) {
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
  if (e.color === "#4ba8f5") {
    gradient.addColorStop(0, "#a9dcff");
    gradient.addColorStop(1, "#348bd2");
  } else {
    gradient.addColorStop(0, "#ffb1b1");
    gradient.addColorStop(1, "#d94c4c");
  }
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
  if (e.stacked && e.side === winner) {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,213,79,${0.5 + Math.sin(performance.now() / 150) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(-ERASER.length / 2, -ERASER.width / 2, ERASER.length, ERASER.width);
  }

  ctx.restore();
}

// Player direction arrow (lengthens and changes color while charging)
function drawArrow() {
  if (turn !== "player" || moving || gameOver) return;

  const x = player.x;
  const y = player.y;
  const length = 85 + power * 0.9;

  const endX = x + Math.cos(direction) * length;
  const endY = y + Math.sin(direction) * length;

  const color = power > 80 ? "#ff8a65" : power > 40 ? "#ffd54f" : "#ffffff";

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
  ctx.rotate(direction);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-14, -9);
  ctx.lineTo(-14, 9);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Target indicator ring (pulsing animation)
function drawTarget() {
  if (gameOver || moving) return;

  const target = turn === "player" ? ai : player;
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

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();

  // Camera: shake + zoom
  if (screenShakeTime > 0) {
    const k = screenShakePower * (screenShakeTime / screenShakeTotal);
    ctx.translate(random(-k, k), random(-k, k));
  }
  if (zoom !== 1) {
    ctx.translate(zoomCenter.x, zoomCenter.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-zoomCenter.x, -zoomCenter.y);
  }

  drawTable();
  drawMotes();
  drawTarget();
  drawTrails();
  drawChargeAura();

  // Layering: higher z on top; winner on top if equal z
  const order = [player, ai].sort((a, b) =>
    a.z - b.z || (a.side === winner ? 1 : 0) - (b.side === winner ? 1 : 0)
  );
  order.forEach(drawEraser);

  drawSpeedLines(player);
  drawSpeedLines(ai);
  drawArrow();
  drawShockwaves();
  drawParticles();
  drawFloatTexts();

  ctx.restore();

  drawVignette();
  drawLandingFlash();
}

// Main loop
function gameLoop(timestamp) {
  let dt = Math.min(timestamp - lastTime || 16.67, 33);
  lastTime = timestamp;

  // Slow motion
  if (slowMoTime > 0) {
    slowMoTime -= dt;
    dt *= 0.3;
  }

  if (charging && !gameOver) {
    power = Math.min(100, (performance.now() - chargeStart) / 1800 * 100);
    updatePower();

    chargeFx += dt;
    if (chargeFx > 30) {
      chargeFx = 0;
      chargeEffect(player, power);
    }

    // Slight shake at full power
    if (power >= 100) screenShake(1.2, 60);
  }

  if (moving && activeEraser) {
    updateFlight(activeEraser, dt);
  }

  updateVFX(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

document.getElementById("restart").addEventListener("click", resetGame);
document.getElementById("playAgain").addEventListener("click", resetGame);

// Start
initMotes();
resetGame();
requestAnimationFrame(gameLoop);