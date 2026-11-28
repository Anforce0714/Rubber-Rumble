// Eraser shop: preview, buy, equip
import { sfx } from './audio.js';
import { applySkinVars, getSkin, SKINS } from './skins.js';
import {
  buySkin, equipSkin, getEquippedSkinId, getGold, isSkinOwned
} from './storage.js';

const $ = id => document.getElementById(id);

let previewId = null;   // skin currently shown in the large preview

function message(text, kind = "") {
  const el = $("shopMessage");
  el.textContent = text;
  el.className = "hint " + kind;
}

function nudge(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function makeCard(skin, equippedId, gold) {
  const owned = isSkinOwned(skin.id);
  const equipped = skin.id === equippedId;

  const card = document.createElement("button");
  card.className = "skin-card";
  card.dataset.skin = skin.id;
  if (equipped) card.classList.add("equipped");
  else if (owned) card.classList.add("owned");
  else card.classList.add("locked");
  if (skin.id === previewId) card.classList.add("selected");
  if (!owned && gold >= skin.price) card.classList.add("affordable");

  const swatch = document.createElement("span");
  swatch.className = "eraser-mini";
  applySkinVars(swatch, skin);

  const name = document.createElement("span");
  name.className = "skin-name";
  name.textContent = skin.name;

  const status = document.createElement("span");
  status.className = "skin-status";
  if (equipped) status.textContent = "✓ EQUIPPED";
  else if (owned) status.textContent = "OWNED";
  else status.textContent = `🔒 🪙 ${skin.price}`;

  card.append(swatch, name, status);
  return card;
}

export function renderShop() {
  const equippedId = getEquippedSkinId();
  const gold = getGold();
  if (!previewId) previewId = equippedId;

  $("shopGold").textContent = gold;

  // grid
  const grid = $("skinGrid");
  grid.textContent = "";
  SKINS.forEach(skin => grid.appendChild(makeCard(skin, equippedId, gold)));

  // large preview + action button
  const skin = getSkin(previewId);
  const owned = isSkinOwned(skin.id);
  const equipped = skin.id === equippedId;
  const action = $("shopAction");

  applySkinVars($("shopPreviewEraser"), skin);
  $("shopPreviewName").textContent = skin.name;
  action.classList.remove("btn-gold", "btn-dark", "btn-disabled");

  if (equipped) {
    $("shopPreviewStatus").textContent = "Currently equipped";
    action.textContent = "EQUIPPED ✓";
    action.disabled = true;
    action.classList.add("btn-dark");
  } else if (owned) {
    $("shopPreviewStatus").textContent = "You own this colour";
    action.textContent = "EQUIP";
    action.disabled = false;
  } else if (gold >= skin.price) {
    $("shopPreviewStatus").textContent = `Locked · costs ${skin.price} Gold`;
    action.textContent = `BUY · 🪙 ${skin.price}`;
    action.disabled = false;
    action.classList.add("btn-gold");
  } else {
    $("shopPreviewStatus").textContent = `Locked · costs ${skin.price} Gold`;
    action.textContent = `NEED ${skin.price - gold} MORE 🪙`;
    action.disabled = false;               // clickable so we can explain why it fails
    action.classList.add("btn-dark", "btn-disabled");
  }
}

function onAction() {
  const skin = getSkin(previewId);

  if (isSkinOwned(skin.id)) {
    const r = equipSkin(skin.id);
    if (r.ok) message(`${skin.name} equipped!`, "good");
  } else {
    const r = buySkin(skin.id);
    if (r.ok) {
      equipSkin(skin.id);                  // equip right after buying
      sfx.coin();
      message(`Purchased ${skin.name}! It is now equipped.`, "good");
    } else if (r.reason === "insufficient") {
      message(`Not enough Gold: you need ${r.missing} more. Win battles to earn Gold!`, "bad");
      sfx.error();
      nudge($("shopAction"));
    }
  }

  renderShop();
}

export function initShop() {
  $("skinGrid").addEventListener("click", event => {
    const card = event.target.closest(".skin-card");
    if (!card) return;
    previewId = card.dataset.skin;
    message("");
    renderShop();
  });

  $("shopAction").addEventListener("click", onAction);
}

// Called when the shop screen opens
export function openShop() {
  previewId = getEquippedSkinId();
  message("");
  renderShop();
}