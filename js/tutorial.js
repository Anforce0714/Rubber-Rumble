// First-time hints shown during the player's very first battle
import { isTutorialDone, markTutorialDone } from './storage.js';

const STEPS = {
  aim: "👆 Click or drag on the table to aim your eraser",
  charge: "🔵 Now press and HOLD the shoot button to charge",
  release: "🎯 Release to shoot! Land on top of the rival's eraser"
};

let step = null;

function show(name) {
  const tip = document.getElementById("tutorialTip");
  if (!tip) return;
  step = name;
  tip.textContent = STEPS[name];
  tip.classList.remove("hidden");
}

function hide() {
  const tip = document.getElementById("tutorialTip");
  if (tip) tip.classList.add("hidden");
  step = null;
}

// Call when a battle starts
export function startTutorial() {
  if (isTutorialDone()) hide();
  else show("aim");
}

export function stopTutorial() {
  hide();
}

// name: "aim" | "charge" | "shoot"
export function tutorialEvent(name) {
  if (!step) return;

  if (name === "aim" && step === "aim") show("charge");
  else if (name === "charge" && (step === "aim" || step === "charge")) show("release");
  else if (name === "shoot") {
    markTutorialDone();
    hide();
  }
}