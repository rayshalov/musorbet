/* ===== drennydrop — админ-панель ===== */

/* PIN задаётся хешем ADMIN_PIN_HASH в app.js (инструкция рядом с ним).
   Локально можно создать файл admin-pin.js со строкой var ADMIN_PIN="..." — он в .gitignore. */

const ADB_KEY = "fragdrop_admin_v1";

function adminAuthed(){
  try{ return sessionStorage.getItem(ADB_KEY) === "1"; }catch(e){ return false; }
}
function tryAdminLogin(){
  const input = $("#pin-input") || $("#admin-pin");
  if(!input) return;
  checkAdminPin(input.value).then(ok=>{
    if(ok){
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
  });
}

function showPanel(){
  $("#admin-login").hidden = true;
  $("#admin-panel").hidden = false;
  renderAdminStats();
  renderAdminInv();
  fillExactSelect();
  watchCloudStats();
}

/* при включённом Firebase показываем живую глобальную статистику всех игроков */
let cloudWatchStarted = false;
function watchCloudStats(){
  if(!Cloud.enabled || cloudWatchStarted) return;
  const start = () => {
    if(cloudWatchStarted) return;
    cloudWatchStarted = true;
    Cloud.watchGlobal(s=>{
      $("#st-total").textContent  = s.total  || 0;
      $("#st-wins").textContent   = s.wins   || 0;
      $("#st-losses").textContent = s.losses || 0;
      $("#st-won").textContent    = fmt(s.won  || 0);
      $("#st-lost").textContent   = fmt(s.lost || 0);
      const badge = $("#stats-badge");
      if(badge) badge.hidden = false;
    });
    Cloud.playerCount().then(n=>{
      const el = $("#st-players");
      if(el && n != null) el.textContent = n;
    });
  };
  if(Cloud.ready) start();
  else setTimeout(start, 1500);   // ждём анонимный вход в облако
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
  $("#st-balance").textContent = fmt(DB.balance);
  $("#st-won").textContent = fmt(s.won);
  $("#st-lost").textContent = fmt(s.lost);
}

/* начислить/списать баланс (отрицательное число — списать) */
function grantBalance(){
  const v = Math.max(-1000000, Math.min(1000000, +$("#grant-bal").value || 0));
  if(!v){ toast("Введи сумму (можно отрицательную)","err"); return; }
  DB.balance = Math.max(0, Math.round((DB.balance + v)*100)/100);
  saveDB(); renderAdminStats();
  toast(`Баланс изменён: ${fmt(DB.balance)}`,"ok");
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
  const name = $("#cs-name").value.trim().slice(0, 64);          // лимиты = правила Firestore
  const rar = $("#cs-rar").value;
  const price = Math.min(9800, Math.max(0.01, +$("#cs-price").value || 1));
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
  const cloudNote = Cloud.enabled
    ? "\n\nГлобальная облачная статистика правилами защищена от обнуления клиентом — сбрасывай её через консоль Firebase (Firestore → stats/global)."
    : "";
  if(!confirm("Сбросить статистику апгрейдов?" + cloudNote)) return;
  DB.stats = { total:0, wins:0, losses:0, won:0, lost:0 };
  saveDB(); renderAdminStats();
  toast("Локальная статистика сброшена","ok");
}

function wipeAll(){
  if(!confirm("ВАЙП: удалить инвентарь и статистику этого браузера?")) return;
  if(!confirm("Точно-точно? Отменить будет нельзя.")) return;
  localStorage.removeItem("fragdrop_db_v1");
  DB = loadDB();
  renderAdminInv(); renderAdminStats();
  if(Cloud.enabled){
    // облачные данные правилами защищены: инвентари игроков и статистика
    // удаляются только вручную через консоль Firebase
    toast("Облачные данные защищены правилами — чисти через консоль Firebase","err");
  } else {
    toast("Всё уничтожено. Начинаем с нуля.","err");
  }
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  [ $("#pin-input"), $("#admin-pin") ].forEach(p=>{
    if(p) p.addEventListener("keydown", e=>{ if(e.key==="Enter") tryAdminLogin(); });
  });
  if(adminAuthed()) showPanel();
});
