// Trophy and Gold economy rules (pure data + functions, no DOM, no imports)

// Reward by AI tier. Easy AI = Easy Mode levels 1-10, Normal AI = Easy Mode 11-20,
// Hard AI = Hard Mode (see getAITier in levels.js)
export const TIER_REWARDS = {
  easy:   { trophies: 10, gold: 20, label: "Easy AI" },
  normal: { trophies: 20, gold: 35, label: "Normal AI" },
  hard:   { trophies: 30, gold: 50, label: "Hard AI" }
};

export const DEFEAT_REWARD = { trophies: -10, gold: 5 };
export const LEVEL_COMPLETE_GOLD = 30;   // every victory
export const FIRST_CLEAR_GOLD = 50;      // only the first time a level is cleared

export const LEAGUES = [
  { name: "Bronze",      icon: "🥉", min: 0 },
  { name: "Silver",      icon: "🥈", min: 500 },
  { name: "Gold League", icon: "🥇", min: 1000 },
  { name: "Diamond",     icon: "💎", min: 2000 },
  { name: "Master",      icon: "🔮", min: 3500 },
  { name: "Champion",    icon: "👑", min: 5000 }
];

// League info for a trophy count, including progress toward the next league
export function getLeague(trophies) {
  const t = Math.max(0, Math.floor(Number(trophies) || 0));

  let index = 0;
  for (let i = 0; i < LEAGUES.length; i++) {
    if (t >= LEAGUES[i].min) index = i;
  }

  const league = LEAGUES[index];
  const next = LEAGUES[index + 1] || null;

  return {
    name: league.name,
    icon: league.icon,
    index,
    min: league.min,
    max: next ? next.min - 1 : null,
    nextName: next ? next.name : null,
    nextMin: next ? next.min : null,
    progress: next ? (t - league.min) / (next.min - league.min) : 1,
    toNext: next ? next.min - t : 0
  };
}

// What one finished match pays out (trophies may be negative; the floor at 0
// is applied by storage). Gold is never negative.
export function calculateMatchReward(tier, won, firstClear) {
  if (!won) {
    return {
      trophies: DEFEAT_REWARD.trophies,
      gold: DEFEAT_REWARD.gold,
      breakdown: { win: 0, completion: 0, firstClear: 0, defeat: DEFEAT_REWARD.gold }
    };
  }

  const t = TIER_REWARDS[tier] || TIER_REWARDS.easy;
  const first = firstClear ? FIRST_CLEAR_GOLD : 0;

  return {
    trophies: t.trophies,
    gold: t.gold + LEVEL_COMPLETE_GOLD + first,
    breakdown: { win: t.gold, completion: LEVEL_COMPLETE_GOLD, firstClear: first, defeat: 0 }
  };
}