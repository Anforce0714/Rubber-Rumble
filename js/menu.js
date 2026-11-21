// Menus: main menu, mode select, level select, how-to-play, settings, result buttons
import { startBattle, stopBattle } from './game.js';
import { getNextLevel, LEVELS_PER_MODE, MODES } from './levels.js';
import { S } from './state.js';
import {
  getCompleted, getSettings, getUnlockedLevel, isHardModeUnlocked,
  isLevelCompleted, isLevelUnlocked, isModeUnlocked, resetProgress, setSetting
} from './storage.js';

const $ = id => document.getElementById(id);

const SCREENS = ["menu", "modes", "levels", "how", "settings", "battle"];

let levelsMode = "easy";      // mode shown on the level screen
let levelsFrom = "modes";     // where the level screen's Back button goes
let resetArmed = false;
let resetTimer = null;

export function showScreen(name) {
  SCREENS.forEach(id => {
    const el = $(id === "battle" ? "battle" : "screen-" + id);
    el.classList.toggle("hidden", id !== name);
  });
}

function nudge(el) {
  el.classList.remove("shake");
  void el.offsetWidth; // restart animation
  el.classList.add("shake");
}

// ---------- mode selection ----------

function renderModes() {
  ["easy", "hard"].forEach(mode => {
    const done = getCompleted(mode);
    const cap = mode === "easy" ? "Easy" : "Hard";
    $(mode + "Progress").textContent = `${done} / ${LEVELS_PER_MODE} cleared`;
    $(mode + "Bar").style.width = (done / LEVELS_PER_MODE * 100) + "%";
    $("mode" + cap).classList.toggle("locked", !isModeUnlocked(mode));
  });

  const hardOpen = isHardModeUnlocked();
  $("hardIcon").textContent = hardOpen ? "🔥" : "🔒";
  $("modeHint").textContent = hardOpen ? "" : "🔒 Hard Mode unlocks after you complete Easy Level 20.";
}

function openModes() {
  renderModes();
  showScreen("modes");
}

// ---------- level selection ----------

function renderLevels() {
  const mode = levelsMode;
  const done = getCompleted(mode);
  const unlocked = getUnlockedLevel(mode);

  $("levelsTitle").textContent = MODES[mode].name;
  $("tabEasy").classList.toggle("active", mode === "easy");
  $("tabHard").classList.toggle("active", mode === "hard");
  $("tabHard").classList.toggle("locked", !isHardModeUnlocked());
  $("tabHard").textContent = isHardModeUnlocked() ? "Hard" : "🔒 Hard";

  $("levelsProgress").textContent = `${done} / ${LEVELS_PER_MODE} cleared`;
  $("levelsBar").style.width = (done / LEVELS_PER_MODE * 100) + "%";

  const grid = $("levelGrid");
  grid.textContent = "";

  for (let lv = 1; lv <= LEVELS_PER_MODE; lv++) {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.dataset.level = lv;

    if (!isLevelUnlocked(mode, lv)) {
      btn.classList.add("locked");
      btn.disabled = true;
      btn.textContent = "🔒";
      btn.setAttribute("aria-label", `Level ${lv} locked`);
    } else {
      btn.textContent = lv;
      btn.setAttribute("aria-label", `Level ${lv}`);

      if (isLevelCompleted(mode, lv)) {
        btn.classList.add("completed");
        const tick = document.createElement("span");
        tick.className = "tick";
        tick.textContent = "✓";
        btn.appendChild(tick);
      } else if (lv === unlocked) {
        btn.classList.add("current");
      }
    }

    grid.appendChild(btn);
  }

  $("levelsHint").textContent =
    done >= LEVELS_PER_MODE ? "All levels in this mode cleared!" : "Win a level to unlock the next one.";
}

function openLevels(mode, from) {
  levelsMode = mode;
  levelsFrom = from;
  renderLevels();
  showScreen("levels");
}

// ---------- battle ----------

function startLevel(mode, level) {
  if (!isLevelUnlocked(mode, level)) return;
  showScreen("battle");
  startBattle(mode, level);
}

function backToMenu() {
  stopBattle();
  showScreen("menu");
}

// ---------- settings ----------

function renderSettings() {
  $("toggleShake").setAttribute("aria-checked", String(S.settings.screenShake));
  disarmReset();
}

function disarmReset() {
  resetArmed = false;
  clearTimeout(resetTimer);
  $("resetProgress").textContent = "RESET";
}

// ---------- wiring ----------

export function initMenu() {
  // Buttons with data-action
  document.addEventListener("click", event => {
    const el = event.target.closest("[data-action]");
    if (!el) return;

    switch (el.dataset.action) {
      case "play": openModes(); break;
      case "levels": openLevels("easy", "menu"); break;
      case "how": showScreen("how"); break;
      case "settings": renderSettings(); showScreen("settings"); break;
      case "back-menu": showScreen("menu"); break;
      case "back-levels": levelsFrom === "modes" ? openModes() : showScreen("menu"); break;
    }
  });

  // Mode cards
  document.querySelectorAll(".mode-card").forEach(card => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      if (!isModeUnlocked(mode)) {
        nudge(card);
        return;
      }
      openLevels(mode, "modes");
    });
  });

  // Level tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.tab;
      if (!isModeUnlocked(mode)) {
        nudge(tab);
        $("levelsHint").textContent = "🔒 Complete Easy Level 20 to unlock Hard Mode.";
        return;
      }
      levelsMode = mode;
      renderLevels();
    });
  });

  // Level buttons (event delegation)
  $("levelGrid").addEventListener("click", event => {
    const btn = event.target.closest(".level-btn");
    if (!btn || btn.disabled) return;
    startLevel(levelsMode, Number(btn.dataset.level));
  });

  // Battle header + result overlay buttons
  $("menuBtn").addEventListener("click", backToMenu);
  $("resultMenu").addEventListener("click", backToMenu);
  $("retryBtn").addEventListener("click", () => startLevel(S.mode, S.level));
  $("nextLevel").addEventListener("click", () => {
    const next = getNextLevel(S.mode, S.level);
    if (next) startLevel(next.mode, next.level);
  });

  // Settings
  $("toggleShake").addEventListener("click", () => {
    S.settings.screenShake = !S.settings.screenShake;
    setSetting("screenShake", S.settings.screenShake);
    $("toggleShake").setAttribute("aria-checked", String(S.settings.screenShake));
  });

  $("resetProgress").addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      $("resetProgress").textContent = "TAP AGAIN";
      resetTimer = setTimeout(disarmReset, 3000);
      return;
    }
    resetProgress();
    disarmReset();
    $("resetProgress").textContent = "DONE ✓";
    resetTimer = setTimeout(disarmReset, 1500);
  });

  showScreen("menu");
}