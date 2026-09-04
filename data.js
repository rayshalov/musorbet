/* ===== Каталог скинов CS2 ===== */
/* rarity: blue / purple / pink / red / gold */
const SKINS = [
  // --- Consumer / Mil-Spec (синие) ---
  { name:"MP9 | Sand Dashed", price:0.40, rar:"blue", img:"img/mp9_sand_dashed.png" },
  { name:"P250 | Sand Dune", price:0.35, rar:"blue", img:"img/p250_sand_dune.png" },
  { name:"Nova | Polar Mesh", price:0.30, rar:"blue", img:"img/nova_polar_mesh.png" },
  { name:"MP7 | Skulls", price:0.55, rar:"blue", img:"img/mp7_skulls.png" },
  { name:"Galil AR | Winter Forest", price:0.60, rar:"blue", img:"img/galil_ar_winter_forest.png" },
  { name:"FAMAS | Pulse", price:0.75, rar:"blue", img:"img/famas_pulse.png" },
  { name:"MAC-10 | Silver", price:0.50, rar:"blue", img:"img/mac_10_silver.png" },
  { name:"UMP-45 | Urban DDPAT", price:0.45, rar:"blue", img:"img/ump_45_urban_ddpat.png" },
  { name:"SG 553 | Waves Perforated", price:0.65, rar:"blue", img:"img/sg_553_waves_perforated.png" },
  { name:"Five-SeveN | Case Hardened", price:1.20, rar:"blue", img:"img/five_seven_case_hardened.png" },

  // --- Restricted (фиолетовые) ---
  { name:"AK-47 | Slate", price:3.50, rar:"purple", img:"img/ak_47_slate.png" },
  { name:"MP7 | Bloodsport", price:2.80, rar:"purple", img:"img/mp7_bloodsport.png" },
  { name:"CZ75-Auto | The Fuschia Is Now", price:2.10, rar:"purple", img:"img/cz75_auto_the_fuschia_is_now.png" },
  { name:"USP-S | Cortex", price:4.20, rar:"purple", img:"img/usp_s_cortex.png" },
  { name:"Glock-18 | Weasel", price:3.10, rar:"purple", img:"img/glock_18_weasel.png" },
  { name:"M4A1-S | Decimator", price:5.40, rar:"purple", img:"img/m4a1_s_decimator.png" },
  { name:"Galil AR | Sugar Rush", price:4.60, rar:"purple", img:"img/galil_ar_sugar_rush.png" },
  { name:"SSG 08 | Blood in the Water", price:6.80, rar:"purple", img:"img/ssg_08_blood_in_the_water.png" },
  { name:"P90 | Asiimov", price:7.20, rar:"purple", img:"img/p90_asiimov.png" },
  { name:"MAC-10 | Neon Rider", price:8.50, rar:"purple", img:"img/mac_10_neon_rider.png" },

  // --- Classified (розовые) ---
  { name:"AK-47 | Frontside Misty", price:14.00, rar:"pink", img:"img/ak_47_frontside_misty.png" },
  { name:"M4A4 | Desolate Space", price:16.50, rar:"pink", img:"img/m4a4_desolate_space.png" },
  { name:"AWP | Hyper Beast", price:35.00, rar:"pink", img:"img/awp_hyper_beast.png" },
  { name:"Desert Eagle | Code Red", price:42.00, rar:"pink", img:"img/desert_eagle_code_red.png" },
  { name:"USP-S | Neo-Noir", price:22.00, rar:"pink", img:"img/usp_s_neo_noir.png" },
  { name:"Glock-18 | Water Elemental", price:12.00, rar:"pink", img:"img/glock_18_water_elemental.png" },
  { name:"M4A1-S | Leaded Glass", price:18.00, rar:"pink", img:"img/m4a1_s_leaded_glass.png" },
  { name:"SSG 08 | Fever Dream", price:11.50, rar:"pink", img:"img/ssg_08_fever_dream.png" },

  // --- Covert (красные) ---
  { name:"AK-47 | Asiimov", price:85.00, rar:"red", img:"img/ak_47_asiimov.png" },
  { name:"AWP | Asiimov", price:145.00, rar:"red", img:"img/awp_asiimov.png" },
  { name:"AK-47 | Redline", price:55.00, rar:"red", img:"img/ak_47_redline.png" },
  { name:"M4A4 | Howl", price:2200.00, rar:"red", img:"img/m4a4_howl.png" },
  { name:"AWP | Dragon Lore", price:1450.00, rar:"red", img:"img/awp_dragon_lore.png" },
  { name:"AK-47 | Wild Lotus", price:9800.00, rar:"red", img:"img/ak_47_wild_lotus.png" },
  { name:"AWP | The Prince", price:320.00, rar:"red", img:"img/awp_the_prince.png" },
  { name:"AK-47 | Fire Serpent", price:780.00, rar:"red", img:"img/ak_47_fire_serpent.png" },
  { name:"Desert Eagle | Blaze", price:410.00, rar:"red", img:"img/desert_eagle_blaze.png" },
  { name:"AK-47 | Vulcan", price:190.00, rar:"red", img:"img/ak_47_vulcan.png" },

  // --- Knives (золотые) ---
  { name:"★ Karambit | Doppler", price:1200.00, rar:"gold", img:"img/karambit_doppler.png" },
  { name:"★ Butterfly | Fade", price:2350.00, rar:"gold", img:"img/butterfly_fade.png" },
  { name:"★ M9 Bayonet | Lore", price:890.00, rar:"gold", img:"img/m9_bayonet_lore.png" },
  { name:"★ Bayonet | Tiger Tooth", price:640.00, rar:"gold", img:"img/bayonet_tiger_tooth.png" },
  { name:"★ Talon | Marble Fade", price:990.00, rar:"gold", img:"img/talon_marble_fade.png" },
  { name:"★ Skeleton | Crimson Web", price:1750.00, rar:"gold", img:"img/skeleton_crimson_web.png" },
  { name:"★ Sport Gloves | Pandora's Box", price:1850.00, rar:"gold", img:"img/sport_gloves_pandora_s_box.png" },
  { name:"★ Flip Knife | Gamma Doppler", price:560.00, rar:"gold", img:"img/flip_knife_gamma_doppler.png" },
  { name:"★ Huntsman | Slaughter", price:330.00, rar:"gold", img:"img/huntsman_slaughter.png" },
  { name:"★ Gloves | Vice", price:2900.00, rar:"gold", img:"img/gloves_vice.png" },
];

const RARITY_NAMES = {
  blue:"Consumer", purple:"Restricted", pink:"Classified", red:"Covert", gold:"★ Knife"
};

const ICONS = {
  blue:"🔫", purple:"🔮", pink:"💗", red:"🔺", gold:"🔪"
};
