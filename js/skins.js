// Eraser colour skins. COSMETIC ONLY: a skin changes colours and nothing else
// (same shape, same physics, same coverage area).

export const DEFAULT_SKIN = "classicRed";

export const SKINS = [
  { id: "classicRed",   name: "Classic Red",    price: 0,    main: "#ef6666", light: "#ffb1b1", dark: "#d94c4c" },
  { id: "oceanBlue",    name: "Ocean Blue",     price: 100,  main: "#4ba8f5", light: "#a9dcff", dark: "#348bd2" },
  { id: "forestGreen",  name: "Forest Green",   price: 150,  main: "#4cc36f", light: "#a8f0b8", dark: "#2e9e52" },
  { id: "sunshine",     name: "Sunshine Yellow", price: 200, main: "#ffd84d", light: "#fff59d", dark: "#f2b800" },
  { id: "purple",       name: "Purple",         price: 300,  main: "#a566e8", light: "#d7b2ff", dark: "#7e3fc4" },
  { id: "orange",       name: "Orange",         price: 400,  main: "#ff9a3c", light: "#ffd0a0", dark: "#e8720c" },
  { id: "pink",         name: "Pink",           price: 500,  main: "#ff7cc0", light: "#ffc1e3", dark: "#e0509c" },
  { id: "cyan",         name: "Cyan",           price: 650,  main: "#40e0e8", light: "#b2fff6", dark: "#17b3c4" },
  { id: "black",        name: "Black",          price: 800,  main: "#6b7280", light: "#8a8f9c", dark: "#15171c" },
  { id: "gold",         name: "Gold",           price: 1200, main: "#ffcf33", light: "#fff2a8", dark: "#d99a00" }
];

export function getSkin(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

export function isValidSkin(id) {
  return SKINS.some(s => s.id === id);
}

// Colours the AI may use. The AI never uses the player's colour.
const AI_PALETTE = ["oceanBlue", "classicRed", "forestGreen", "purple", "orange"];

export function getAISkin(playerSkinId, mode, level) {
  const options = AI_PALETTE.filter(id => id !== playerSkinId);
  const offset = (mode === "hard" ? 5 : 0) + (level - 1);
  return getSkin(options[((offset % options.length) + options.length) % options.length]);
}

// Sets CSS variables used by the .eraser-* preview styles
export function applySkinVars(el, skin) {
  el.style.setProperty("--light", skin.light);
  el.style.setProperty("--dark", skin.dark);
}