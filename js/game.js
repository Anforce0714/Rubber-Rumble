import { aiTurn } from './ai.js';
import { H, W } from './constants.js';
import { getLevelConfig, getNextLevel, MODES } from './levels.js';
import { canvas, instruction, launchButton, levelBadge, nextLevelButton, resultInfo, resultRewards, retryButton, playerDot, aiDot, powerFill, powerText, result, resultText, resultTitle, statusText } from './dom.js';
import { checkLanding, createEraser, updateFlight } from './physics.js';
import { draw } from './render.js';
import { S } from './state.js';
import { getSettings, getEquippedSkin, recordMatch } from './storage.js';
import { getAISkin } from './skins.js';
import { getRandomSpawn } from './spawn.js';
import { addFloatText, chargeEffect, createDust, createShockwave, createSparks, createVictoryParticles, flash, initMotes, screenShake, updateVFX } from './vfx.js';

export function resetGame() {
  clearTimeout(S.aiTimer);
  clearTimeout(S.resultTimer);

  // Skins are cosmetic: only colours differ, positions/size/physics are identical
  const playerSkin = getEquippedSkin();
  const aiSkin = getAISkin(playerSkin.id, S.mode || "easy", S.level || 1);

  // Random starting positions and rotations
  const spawn = getRandomSpawn();

  S.player = createEraser(spawn.player.x, spawn.player.y, playerSkin.main, "player");
  S.player.angle = spawn.player.angle;
  S.player.light = playerSkin.light;
  S.player.dark = playerSkin.dark;

  S.ai = createEraser(spawn.ai.x, spawn.ai.y, aiSkin.main, "ai");
  S.ai.angle = spawn.ai.angle;
  S.ai.light = aiSkin.light;
  S.ai.dark = aiSkin.dark;

  playerDot.style.background = playerSkin.main;
  aiDot.style.background = aiSkin.main;

  // New match = new reward token (a match can only be rewarded once)
  S.matchToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  resultRewards.textContent = "";

  S.turn = "player";
  S.direction = Math.atan2(S.ai.y - S.player.y, S.ai.x - S.player.x);
  S.power = 0;

  S.charging = false;
  S.aiming = false;
  S.moving = false;
  S.gameOver = false;

  S.activeEraser = null;
  S.winner = null;

  S.particles = [];
  S.trails = [];
  S.shockwaves = [];
  S.floatTexts = [];
  S.screenShakeTime = 0;
  S.screenShakePower = 0;
  S.landingFlash = 0;
  S.zoom = 1;
  S.slowMoTime = 0;

  result.classList.add("hidden");
  launchButton.disabled = false;
  launchButton.classList.remove("charging");

  statusText.textContent = "Player's Turn: Choose Direction";
  instruction.textContent = "Click the table to choose launch direction";

  updatePower();
  draw();
}

export function updatePower() {
  powerFill.style.width = S.power + "%";
  powerText.textContent = Math.round(S.power) + "%";
}

export function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * W / rect.width,
    y: (event.clientY - rect.top) * H / rect.height
  };
}

export function setDirectionFromPointer(event) {
  const pos = getPointerPosition(event);
  S.direction = Math.atan2(pos.y - S.player.y, pos.x - S.player.x);
}

// Launch eraser
export function launch(eraser, angle, strength, targetAngle = angle) {
  if (S.moving || S.gameOver) return;

  S.activeEraser = eraser;
  S.moving = true;

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

// Game over
// Fill the reward chips on the result screen
function showRewards(r) {
  resultRewards.textContent = "";
  if (!r) return;

  const chip = (cls, text) => {
    const el = document.createElement("span");
    el.className = "reward-chip " + cls;
    el.textContent = text;
    resultRewards.appendChild(el);
  };

  chip("trophy", `${r.trophyDelta >= 0 ? "+" : ""}${r.trophyDelta} 🏆`);
  chip("gold", `+${r.goldDelta} 🪙`);

  const parts = [];
  if (r.won) {
    parts.push(`Win +${r.breakdown.win}`, `Level +${r.breakdown.completion}`);
    if (r.breakdown.firstClear) parts.push(`First clear +${r.breakdown.firstClear}`);
  } else {
    parts.push(`Consolation +${r.breakdown.defeat}`);
  }

  const detail = document.createElement("span");
  detail.className = "reward-detail";
  detail.textContent = "Gold: " + parts.join(" · ");
  resultRewards.appendChild(detail);

  if (r.leagueChange !== 0) {
    const el = document.createElement("span");
    el.className = "reward-league " + (r.leagueChange > 0 ? "up" : "down");
    el.textContent = r.leagueChange > 0 ? `⬆ Promoted to ${r.leagueAfter}!` : `⬇ Dropped to ${r.leagueAfter}`;
    resultRewards.appendChild(el);
  }
}

export function endGame(side) {
  if (S.gameOver) return;

  S.gameOver = true;
  S.moving = false;
  S.charging = false;
  launchButton.classList.remove("charging");

  const winningEraser = side === "player" ? S.player : S.ai;

  createVictoryParticles(winningEraser.x, winningEraser.y);

  // Triple golden shockwaves
  createShockwave(winningEraser.x, winningEraser.y, "#ffd54f", 140, 0);
  createShockwave(winningEraser.x, winningEraser.y, "#ffffff", 180, 120);
  createShockwave(winningEraser.x, winningEraser.y, "#ffd54f", 220, 240);

  addFloatText(winningEraser.x, winningEraser.y - 60, "COVER!", "#ffd54f", 40);

  flash("#fff3c4", 1);
  screenShake(9, 350);

  // Slow motion + camera zoom
  S.slowMoTime = 700;
  S.zoom = 1.08;
  S.zoomCenter = { x: winningEraser.x, y: winningEraser.y };

  launchButton.disabled = true;

  // Delay result modal so VFX plays first
  S.resultTimer = setTimeout(() => {
    if (!S.gameOver) return;
    result.classList.remove("hidden");
  }, 900);

  const modeName = S.mode ? MODES[S.mode].short : "";
  const levelName = S.mode ? `${modeName} Mode · Level ${S.level}` : "";
  const next = S.mode ? getNextLevel(S.mode, S.level) : null;

  nextLevelButton.classList.add("hidden");
  retryButton.classList.add("hidden");

  // Trophies, Gold and progress: granted once per match (token guard in storage)
  const matchResult = S.mode ? recordMatch(S.matchToken, S.mode, S.level, side === "player") : null;
  showRewards(matchResult);

  if (side === "player") {
    resultTitle.textContent = "🏆 VICTORY!";
    resultText.textContent = "You covered the AI's eraser with yours!";
    statusText.textContent = "Player covered the target!";

    let info = levelName;

    if (S.mode) {
      const progress = matchResult ? matchResult.progress : {};

      if (progress.hardModeJustUnlocked) {
        info += " · Hard Mode unlocked!";
      } else if (progress.newlyUnlockedLevel) {
        info += ` · Level ${progress.newlyUnlockedLevel} unlocked`;
      } else if (!next) {
        info += " · You cleared every level!";
      }
    }

    resultInfo.textContent = info;

    if (next) {
      nextLevelButton.textContent = next.mode !== S.mode ? "HARD MODE" : "NEXT LEVEL";
      nextLevelButton.classList.remove("hidden");
    }
  } else {
    resultTitle.textContent = "💥 DEFEAT";
    resultText.textContent = "The AI covered your eraser with theirs!";
    statusText.textContent = "AI covered the target!";
    resultInfo.textContent = levelName;
    retryButton.classList.remove("hidden");
  }
}

// Next turn
export function nextTurn() {
  if (S.gameOver) return;

  if (S.turn === "player") {
    S.turn = "ai";
    statusText.textContent = "AI is aiming at you...";
    instruction.textContent = "AI is preparing an attack";
    S.aiTimer = setTimeout(() => aiTurn(launch, S.levelConfig ? S.levelConfig.ai : undefined), 800);
  } else {
    S.turn = "player";
    statusText.textContent = "Player's Turn: Choose Direction";
    instruction.textContent = "Click the table to choose launch direction";
    launchButton.disabled = false;
  }
}

// Main loop
export function gameLoop(timestamp) {
  if (!S.inBattle) {
    S.loopRunning = false;
    return;
  }

  let dt = Math.min(timestamp - S.lastTime || 16.67, 33);
  S.lastTime = timestamp;

  // Slow motion
  if (S.slowMoTime > 0) {
    S.slowMoTime -= dt;
    dt *= 0.3;
  }

  if (S.charging && !S.gameOver) {
    S.power = Math.min(100, (performance.now() - S.chargeStart) / 1800 * 100);
    updatePower();

    S.chargeFx += dt;
    if (S.chargeFx > 30) {
      S.chargeFx = 0;
      chargeEffect(S.player, S.power);
    }

    // Slight shake at full power
    if (S.power >= 100) screenShake(1.2, 60);
  }

  if (S.moving && S.activeEraser) {
    if (updateFlight(S.activeEraser, dt)) handleLanding(S.activeEraser);
  }

  updateVFX(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// Resolve a landing: win check, otherwise MISS and next turn
export function handleLanding(e) {
  const success = checkLanding(e);

  if (success) {
    endGame(S.winner);
  } else {
    addFloatText(e.x, e.y - 50, "MISS", "#b0bec5", 24);
    nextTurn();
  }
}

export function setupInput() {
  // Player chooses direction (supports drag-to-aim)
  canvas.addEventListener("pointerdown", event => {
    if (S.turn !== "player") return;
    if (S.moving || S.charging || S.gameOver) return;

    S.aiming = true;
    setDirectionFromPointer(event);
    instruction.textContent = "Direction set — ready to charge";
  });

  canvas.addEventListener("pointermove", event => {
    if (!S.aiming || S.turn !== "player" || S.moving || S.charging || S.gameOver) return;
    setDirectionFromPointer(event);
  });

  window.addEventListener("pointerup", () => (S.aiming = false));

  // Start charging
  launchButton.addEventListener("pointerdown", event => {
    if (S.turn !== "player") return;
    if (S.moving || S.gameOver || launchButton.disabled) return;

    event.preventDefault();

    S.charging = true;
    S.chargeStart = performance.now();
    launchButton.classList.add("charging");
  });

  // Release power
  function releasePower() {
    if (!S.charging) return;

    S.charging = false;
    launchButton.classList.remove("charging");

    if (S.turn !== "player" || S.gameOver) return;

    const finalPower = Math.max(10, S.power);

    S.power = 0;
    updatePower();

    launch(S.player, S.direction, finalPower);
  }

  launchButton.addEventListener("pointerup", releasePower);
  launchButton.addEventListener("pointercancel", releasePower);
  window.addEventListener("pointerup", releasePower);

  document.getElementById("restart").addEventListener("click", resetGame);
}

export function initGame() {
  S.settings = getSettings();
  setupInput();
  initMotes();
}

// Start (or restart) a campaign level
export function startBattle(mode, level) {
  S.mode = mode;
  S.level = level;
  S.levelConfig = getLevelConfig(mode, level);
  S.inBattle = true;

  levelBadge.textContent = `${MODES[mode].short} · Level ${level}`;

  resetGame();

  if (!S.loopRunning) {
    S.loopRunning = true;
    S.lastTime = 0;
    requestAnimationFrame(gameLoop);
  }
}

// Leave the battle screen (back to menus)
export function stopBattle() {
  clearTimeout(S.aiTimer);
  clearTimeout(S.resultTimer);

  S.inBattle = false;
  S.charging = false;
  S.aiming = false;
  S.moving = false;
  S.gameOver = false;

  launchButton.classList.remove("charging");
  result.classList.add("hidden");
}