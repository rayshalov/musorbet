/* ===== FRAGDROP — админ-панель ===== */

ADMIN_PIN = "1337"; // ← PIN (смени при желании)

const ADB_KEY = "fragdrop_admin_v1";

function adminAuthed(){
  try{ return sessionStorage.getItem(ADB_KEY) === "1"; }catch(e){ return false; }
}
function tryAdminLogin(){
  const input = $("#pin-input") || $("#admin-pin");
  if(!input) return;
  if(input.value === ADMIN_PIN){
    try{ sessionStorage.setItem(ADB_KEY,"1"); }catch(e){}
    const err = $("#pin-error"); if(err) err.hidden = true;
    input.value = "";
    showPanel();
    if($("#admin-modal")) closeAdminModal();
    toast("Добро пожаловать, админ!","ok");
  } else {
    const err = $("#pin-error");
    if(err) err.hidden = false; else toast("Неверный PIN","err");
  }
}

function showPanel(){
  $("#admin-login").hidden = true;
  $("#admin-panel").hidden = false;
  renderAdminStats();
  renderAdminInv();
  fillExactSelect();
}

function closeAdminModal(){ const m=$("#admin-modal"); if(m) m.hidden = true; }
function openAdminModal(){
  const m = $("#admin-modal");
  if(!m) return;
  m.hidden = false;
  $("#admin-pin").focus();
}

/* ---------- статистика ---------- */
function renderAdminStats(){
  const s = DB.stats;
  $("#st-total").textContent = s.total;
  $("#st-wins").textContent = s.wins;
  $("#st-losses").textContent = s.losses;
  $("#st-inv").textContent = DB.inv.length;
  $("#st-invsum").textContent = fmt(invSum());
  $("#st-won").textContent = fmt(s.won);
  $("#st-lost").textContent = fmt(s.lost);
}

/* ---------- инвентарь (клик по карточке = удалить) ---------- */
function renderAdminInv(){
  const grid = $("#admin-inv-grid");
  if(!grid) return;
  grid.innerHTML = DB.inv.slice().reverse().map(x=>skinCard(x)).join("");
  $$("#admin-inv-grid .card").forEach(c=>{
    c.addEventListener("click", ()=>{
      const item = DB.inv.find(i=>i.id === +c.dataset.id);
      if(item && confirm(`Удалить ${item.name} (${fmt(item.price)})?`)){
        removeItem(item.id);
        renderAdminInv();
        renderAdminStats();
        toast("Скин удалён","ok");
      }
    });
  });
  $("#admin-inv-empty").hidden = DB.inv.length > 0;
}

/* ---------- выдача ---------- */
function grantRandom(){
  const rar = $("#grant-rar").value;
  const q = Math.max(1, Math.min(100, +$("#grant-q").value || 1));
  const pool = rar === "all" ? SKINS : SKINS.filter(s=>s.rar===rar);
  if(!pool.length){ toast("Нет скинов такой редкости","err"); return; }
  let last;
  for(let i=0;i<q;i++){
    last = addItem(pool[Math.floor(Math.random()*pool.length)]);
  }
  renderAdminInv(); renderAdminStats();
  toast(`Выдано ${q} шт, последний: ${last.name}`,"ok");
}

function fillExactSelect(){
  const sel = $("#grant-exact");
  if(!sel) return;
  sel.innerHTML = SKINS.map((s,i)=>`<option value="${i}">${s.name} — ${fmt(s.price)}</option>`).join("");
}

function grantExact(){
  const def = SKINS[+$("#grant-exact").value];
  if(!def) return;
  addItem(def);
  renderAdminInv(); renderAdminStats();
  toast(`Выдан ${def.name}`,"ok");
}

function grantBulk(type){
  if(type === "starter"){
    ["P250 | Sand Dune","UMP-45 | Urban DDPAT","MP7 | Skulls","Glock-18 | Weasel",
     "M4A1-S | Decimator","AK-47 | Slate","Glock-18 | Water Elemental",
     "SSG 08 | Fever Dream","AK-47 | Redline","AK-47 | Asiimov"]
      .forEach(n=>{ const s = SKINS.find(x=>x.name===n); if(s) addItem(s); });
    toast("Стартовый набор выдан (10 шт)","ok");
  }
  if(type === "lucky"){
    ["AK-47 | Asiimov","AWP | The Prince","Desert Eagle | Blaze"]
      .forEach(n=>{ const s = SKINS.find(x=>x.name===n); if(s) addItem(s); });
    toast("3 × Covert выданы. Удачи!","ok");
  }
  if(type === "knife"){
    SKINS.filter(s=>s.rar==="gold").forEach(s=>addItem(s));
    toast("Все ножи выданы 🔪","ok");
  }
  renderAdminInv(); renderAdminStats();
}

/* ---------- свой скин ---------- */
function createCustomSkin(){
  const name = $("#cs-name").value.trim();
  const rar = $("#cs-rar").value;
  const price = Math.max(0.01, +$("#cs-price").value || 1);
  if(!name){ toast("Введи название скина","err"); return; }
  addItem({ name, price, rar, ico:"✨" });
  $("#cs-name").value = ""; $("#cs-price").value = "";
  renderAdminInv(); renderAdminStats();
  toast(`Создан ${name} за ${fmt(price)}`,"ok");
}

/* ---------- опасные операции ---------- */
function clearInv(){
  if(!confirm("Точно очистить весь инвентарь?")) return;
  DB.inv = []; saveDB();
  renderAdminInv(); renderAdminStats();
  toast("Инвентарь очищен","ok");
}

function resetStats(){
  if(!confirm("Сбросить статистику апгрейдов?")) return;
  DB.stats = { total:0, wins:0, losses:0, won:0, lost:0 };
  saveDB(); renderAdminStats();
  toast("Статистика сброшена","ok");
}

function wipeAll(){
  if(!confirm("ВАЙП: удалить инвентарь, статистику и всё-всё?")) return;
  if(!confirm("Точно-точно? Отменить будет нельзя.")) return;
  localStorage.removeItem("fragdrop_db_v1");
  DB = loadDB();
  renderAdminInv(); renderAdminStats();
  toast("Всё уничтожено. Начинаем с нуля.","err");
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  [ $("#pin-input"), $("#admin-pin") ].forEach(p=>{
    if(p) p.addEventListener("keydown", e=>{ if(e.key==="Enter") tryAdminLogin(); });
  });
  if(adminAuthed()) showPanel();
});
