/* ===== Каталог скинов CS2 ===== */
/* rarity: blue / purple / pink / red / gold */
const SKINS = [
  // --- Consumer / Mil-Spec (синие) ---
  { name:"MP9 | Sand Dashed", price:0.40, rar:"blue", ico:"🔫" },
  { name:"P250 | Sand Dune", price:0.35, rar:"blue", ico:"🔫" },
  { name:"Nova | Polar Mesh", price:0.30, rar:"blue", ico:"🔫" },
  { name:"MP7 | Skulls", price:0.55, rar:"blue", ico:"🔫" },
  { name:"Galil AR | Winter Forest", price:0.60, rar:"blue", ico:"🔫" },
  { name:"FAMAS | Pulse", price:0.75, rar:"blue", ico:"🔫" },
  { name:"MAC-10 | Silver", price:0.50, rar:"blue", ico:"🔫" },
  { name:"UMP-45 | Urban DDPAT", price:0.45, rar:"blue", ico:"🔫" },
  { name:"SG 553 | Waves Perforated", price:0.65, rar:"blue", ico:"🔫" },
  { name:"Five-SeveN | Case Hardened", price:1.20, rar:"blue", ico:"🔫" },

  // --- Restricted (фиолетовые) ---
  { name:"AK-47 | Slate", price:3.50, rar:"purple", ico:"🔫" },
  { name:"MP7 | Bloodsport", price:2.80, rar:"purple", ico:"🔫" },
  { name:"CZ75-Auto | The Fuschia Is Now", price:2.10, rar:"purple", ico:"🔫" },
  { name:"USP-S | Cortex", price:4.20, rar:"purple", ico:"🔫" },
  { name:"Glock-18 | Weasel", price:3.10, rar:"purple", ico:"🔫" },
  { name:"M4A1-S | Decimator", price:5.40, rar:"purple", ico:"🔫" },
  { name:"Galil AR | Sugar Rush", price:4.60, rar:"purple", ico:"🔫" },
  { name:"SSG 08 | Blood in the Water", price:6.80, rar:"purple", ico:"🎯" },
  { name:"P90 | Asiimov", price:7.20, rar:"purple", ico:"🔫" },
  { name:"MAC-10 | Neon Rider", price:8.50, rar:"purple", ico:"🌈" },

  // --- Classified (розовые) ---
  { name:"AK-47 | Frontside Misty", price:14.00, rar:"pink", ico:"🔫" },
  { name:"M4A4 | Desolate Space", price:16.50, rar:"pink", ico:"🚀" },
  { name:"AWP | Hyper Beast", price:35.00, rar:"pink", ico:"🐉" },
  { name:"Desert Eagle | Code Red", price:42.00, rar:"pink", ico:"🔴" },
  { name:"USP-S | Neo-Noir", price:22.00, rar:"pink", ico:"🌃" },
  { name:"Glock-18 | Water Elemental", price:12.00, rar:"pink", ico:"🌊" },
  { name:"M4A1-S | Leaded Glass", price:18.00, rar:"pink", ico:"🪟" },
  { name:"SSG 08 | Fever Dream", price:11.50, rar:"pink", ico:"😵" },

  // --- Covert (красные) ---
  { name:"AK-47 | Asiimov", price:85.00, rar:"red", ico:"🔫" },
  { name:"AWP | Asiimov", price:145.00, rar:"red", ico:"🔭" },
  { name:"AK-47 | Redline", price:55.00, rar:"red", ico:"🟥" },
  { name:"M4A4 | Howl", price:2200.00, rar:"red", ico:"🔥" },
  { name:"AWP | Dragon Lore", price:1450.00, rar:"red", ico:"🐉" },
  { name:"AK-47 | Wild Lotus", price:9800.00, rar:"red", ico:"🍀" },
  { name:"AWP | The Prince", price:320.00, rar:"red", ico:"👑" },
  { name:"AK-47 | Fire Serpent", price:780.00, rar:"red", ico:"🐍" },
  { name:"Desert Eagle | Blaze", price:410.00, rar:"red", ico:"🔥" },
  { name:"AK-47 | Vulcan", price:190.00, rar:"red", ico:"⚙️" },

  // --- Knives (золотые) ---
  { name:"★ Karambit | Doppler", price:1200.00, rar:"gold", ico:"🔪" },
  { name:"★ Butterfly | Fade", price:2350.00, rar:"gold", ico:"🦋" },
  { name:"★ M9 Bayonet | Lore", price:890.00, rar:"gold", ico:"🗡️" },
  { name:"★ Bayonet | Tiger Tooth", price:640.00, rar:"gold", ico:"🐯" },
  { name:"★ Talon | Marble Fade", price:990.00, rar:"gold", ico:"🦅" },
  { name:"★ Skeleton | Crimson Web", price:1750.00, rar:"gold", ico:"🕸️" },
  { name:"★ Sport Gloves | Pandora's Box", price:1850.00, rar:"gold", ico:"🥊" },
  { name:"★ Flip Knife | Gamma Doppler", price:560.00, rar:"gold", ico:"💚" },
  { name:"★ Huntsman | Slaughter", price:330.00, rar:"gold", ico:"🩸" },
  { name:"★ Gloves | Vice", price:2900.00, rar:"gold", ico:"🧤" },
];

const RARITY_NAMES = {
  blue:"Consumer", purple:"Restricted", pink:"Classified", red:"Covert", gold:"★ Knife"
};

const ICONS = {
  blue:"🔫", purple:"🔮", pink:"💗", red:"🔺", gold:"🔪"
};
