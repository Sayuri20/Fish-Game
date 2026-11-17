/** AI assistance helped connect these shared bonus choices to the game and account. */
export const BONUSES = [
  {
    id: "bubbles",
    name: "Bubble Pack",
    icon: "◉",
    price: 4,
    description: "+6 shots when activated",
  },
  {
    id: "magnet",
    name: "Pearl Magnet",
    icon: "🧲",
    price: 6,
    description: "Pull nearby good items for 8 seconds",
  },
  {
    id: "slow",
    name: "Slow Venom",
    icon: "❄",
    price: 6,
    description: "Slow venom for 5 seconds",
  },
  {
    id: "cleaner",
    name: "Ocean Cleaner",
    icon: "♻",
    price: 5,
    description: "Collect the nearest 2 plastic items",
  },
];
export function findBonus(id) {
  for (const bonus of BONUSES) if (bonus.id === id) return bonus;
  return null;
}
