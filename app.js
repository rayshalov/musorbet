/* ===== drennydrop — core app (игровая логика: колесо апгрейда) ===== */

/* ---------- state ---------- */
const DB_KEY = "fragdrop_db_v1";

function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(raw){
      const db = JSON.parse(raw);
      /* миграция: у скинов, выданных до добавления картинок, нет img — подтягиваем из каталога по имени */
      (db.inv||[]).forEach(x=>{
        if(!x.img){
          const def = SKINS.find(s=>s.name===x.name);
          if(def){ x.img = def.img; x.rar = def.rar; }
        }
      });
      return db;
    }
  }catch(e){}
  return { inv:[], stats:{ total:0, wins:0, losses:0, won:0, lost:0 }, uid:1 };
}
function saveDB(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }catch(e){}
  /* любое изменение инвентаря (в т.ч. выдача из админки) уходит в облако, если оно подключено */
  if(window.Cloud) Cloud.queuePush();
}
let DB = loadDB();

function nextId(){ return DB.uid++; }

function addItem(skinDef){
  const item = { id: nextId(), name: skinDef.name, price: skinDef.price, rar: skinDef.rar, ico: skinDef.ico, img: skinDef.img };
  DB.inv.push(item);
  saveDB();
  return item;
}

function removeItem(id){
  const i = DB.inv.findIndex(x => x.id === id);
  if(i === -1) return null;
  return DB.inv.splice(i,1)[0];
}

function invSum(){ return DB.inv.reduce((s,x)=>s+x.price,0); }
function fmt(n){ return "$" + n.toLocaleString("en-US",{minimumFractionDigits:2, maximumFractionDigits:2}); }

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* картинка скина или эмодзи-заглушка (для кастомных скинов из админки) */
function skinMedia(item){
  return item.img
    ? `<img class="skin-img" src="${esc(item.img)}" alt="" draggable="false" loading="lazy" decoding="async">`
    : (item.ico||"🔫");
}

function skinCard(item, opts={}){
  const cls = ["card","rar-"+item.rar];
  if(opts.selected) cls.push("selected");
  return `<div class="${cls.join(" ")}" data-id="${item.id}">
    <div class="rarity-dot"></div>
    <div class="skin-ico">${skinMedia(item)}</div>
    <div class="skin-name">${esc(item.name)}</div>
    <div class="skin-price">${fmt(item.price)}</div>
  </div>`;
}

function toast(msg, type="ok"){
  const t = document.createElement("div");
  t.className = "toast toast-"+type;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=> t.classList.add("show"));
  setTimeout(()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(),350); }, 2400);
}

/* ---------- upgrader state ---------- */
let selFrom = null;   // скин из инвентаря (ставка)
let selTo = null;     // цель из каталога (награда)
let spinning = false;
let chance = 50;
let wheelAngle = 0;   // текущий угол стрелки (градусы)
let autoPick = true;  // автоподбор цели под выбранный шанс

/* окно допустимых цен цели: [T*0.45 .. T*1.3], где T = ставка × множитель */
function targetWindow(){
  const from = selFrom ? selFrom.price : 0;
  const T = from * (100/chance);
  return { lo: Math.max(from*1.05, T*0.45), hi: T*1.3 };
}
function fairChance(fromPrice, toPrice){
  return Math.max(5, Math.min(95, Math.floor(fromPrice/toPrice*100)));
}

/* автоподбор: цель из окна допустимых, ближайшая по цене к T = ставка × множитель */
function autoPickTarget(){
  if(!selFrom) return null;
  const w = targetWindow();
  const T = selFrom.price * (100/chance);
  const cands = SKINS.filter(s => s.price >= w.lo && s.price <= w.hi);
  if(!cands.length) return null;
  return cands.reduce((a,b)=> Math.abs(a.price-T) <= Math.abs(b.price-T) ? a : b);
}

function applyAutoPick(){
  if(!autoPick || !selFrom) return false;
  const best = autoPickTarget();
  selTo = best;
  renderTo(); renderPool();
  return !!best;
}

function syncAutoToggle(){
  const t = $("#auto-toggle");
  if(t) t.classList.toggle("active", autoPick);
}

/* ---------- колесо: геометрия ---------- */
const R = 120, C = 150, CIRC = 2*Math.PI*R;

/* отрисовать зону игрока на кольце (основная дуга + слой свечения) */
function drawWheelZone(){
  const len = CIRC * chance/100;
  const dash = `${len} ${CIRC}`;
  const arc = $("#win-arc");
  if(arc) arc.setAttribute("stroke-dasharray", dash);
  const glow = $("#win-arc-glow");
  if(glow) glow.setAttribute("stroke-dasharray", dash);
}

/* ---------- шанс: пресеты + драг по колесу ---------- */
function syncPresets(){
  $$(".preset[data-c]").forEach(b=>{
    b.classList.toggle("active", +b.dataset.c === chance);
  });
}

function angleFromEvent(e, el){
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  // угол от 12 часов, по часовой стрелке, в градусах
  let a = Math.atan2(dx, -dy) * 180/Math.PI;
  return ((a % 360) + 360) % 360;
}

function chanceUIInit(){
  $$(".preset[data-c]").forEach(b=>{
    b.addEventListener("click", ()=>{
      if(spinning) return;               // во время прокрута шанс менять нельзя
      Sound.click();
      chance = +b.dataset.c;
      syncChance({resetTarget:true});
      syncPresets();
    });
  });

  /* тумблер автоподбора цели */
  const auto = $("#auto-toggle");
  if(auto){
    auto.addEventListener("click", ()=>{
      if(spinning) return;               // во время прокрута цель подменять нельзя
      Sound.click();
      autoPick = !autoPick;
      syncAutoToggle();
      if(autoPick && selFrom){
        if(!applyAutoPick()){
          toast("Под этот шанс нет подходящей цели — измени шанс или скин","err");
        }
        updateSpinBtn();
      }
    });
  }

  /* драг по кольцу: тянешь — изменяешь размер зоны */
  const wheelEl = $("#wheel");
  if(wheelEl){
    let dragging = false;
    let moved = false;
    const slider = $("#chance-slider");

    wheelEl.addEventListener("pointerdown", e=>{
      if(spinning) return;
      dragging = true; moved = false;
      wheelEl.classList.add("dragging");
      wheelEl.setPointerCapture(e.pointerId);
    });
    wheelEl.addEventListener("pointermove", e=>{
      if(!dragging || spinning) return;
      const a = angleFromEvent(e, wheelEl);
      const c = Math.max(5, Math.min(95, Math.round(a/3.6)));
      if(c !== chance){
        moved = true;
        chance = c;
        if(slider) slider.value = c;
        syncChance({resetTarget:true, noUpdateBtn:false});
        syncPresets();
      }
    });
    wheelEl.addEventListener("pointerup", e=>{
      dragging = false;
      wheelEl.classList.remove("dragging");
      /* клик без движения = нажатие "Апгрейд" не нужно; но клик по центру ничего */
    });
    wheelEl.addEventListener("pointercancel", ()=>{
      dragging = false;
      wheelEl.classList.remove("dragging");
    });
  }

  const slider = $("#chance-slider");
  if(slider){
    slider.addEventListener("input", ()=>{
      chance = +slider.value;
      syncChance({resetTarget:true});
      syncPresets();
    });
  }
  chance = +(slider ? slider.value : 50);
  syncPresets();
}

/* применить шанс ко всем элементам интерфейса */
function syncChance(opts={}){
  drawWheelZone();
  const mult = 100/chance;
  const cv = $("#chance-val");
  cv.textContent = chance + "%";
  $("#up-mult").textContent = mult.toFixed(2) + "×";
  cv.className = chance >= 60 ? "c-green" : (chance >= 30 ? "c-gold" : "c-red");
  syncPresets();

  // при смене шанса: авто-подбор новой цели или сброс вышедшей за окно
  if(opts.resetTarget && selFrom && autoPick){
    applyAutoPick();
  } else if(opts.resetTarget && selTo){
    const w = targetWindow();
    if(selTo.price < w.lo || selTo.price > w.hi){
      selTo = null;
      renderPool();
    }
  }
  if(!opts.noUpdateBtn) updateSpinBtn();
  renderTo(); // обновить "награда ≈"
}

/* ---------- выбор ставки ---------- */
function selectFrom(id){
  if(spinning) return;
  const item = DB.inv.find(x=>x.id===id);
  if(!item) return;
  Sound.select();
  if(selFrom && selFrom.id === id){           // повторный клик — снять выбор
    selFrom = null; selTo = null;
  } else {
    selFrom = item;
    if(autoPick){
      applyAutoPick();                        // сразу подбираем цель под текущий шанс
    } else if(selTo && (selTo.price <= item.price*1.05 || fairChance(item.price, selTo.price) < 5)){
      selTo = null;
      toast("Эта цель не подходит для нового скина","err");
    }
  }
  renderFrom(); renderTo(); renderPool(); updateSpinBtn();
}

function renderFrom(){
  const box = $("#card-from");
  if(!box) return;
  if(selFrom){
    box.className = "card rar-"+selFrom.rar;
    box.innerHTML = `<div class="rarity-dot"></div><div class="skin-ico">${skinMedia(selFrom)}</div><div class="skin-name">${esc(selFrom.name)}</div><div class="skin-price">${fmt(selFrom.price)}</div>`;
  } else {
    box.className = "card locked";
    box.innerHTML = `<div class="card-empty">Выбери скин<br>из инвентаря ↓</div>`;
  }
}

/* ---------- выбор цели ---------- */
function selectTo(idx){
  if(spinning) return;
  const def = SKINS[idx];
  if(!def) return;
  if(!selFrom){ toast("Сначала выбери свой скин из инвентаря","err"); return; }
  if(selTo && selTo.name === def.name){ selTo = null; }   // повторный клик — снять
  else if(def.price <= selFrom.price*1.05){ toast("Цель должна быть дороже твоего скина","err"); return; }
  else if(fairChance(selFrom.price, def.price) < 5){ toast("Слишком дорогая цель для этого скина","err"); return; }
  else {
    Sound.select();
    autoPick = false;                              // ручной выбор отключает автоподбор
    syncAutoToggle();
    selTo = def;
    chance = fairChance(selFrom.price, def.price);   // честный шанс из цен
    const slider = $("#chance-slider");
    if(slider) slider.value = chance;
    syncChance();
  }
  renderTo(); renderPool(); updateSpinBtn();
}

function renderTo(){
  const box = $("#card-to");
  if(!box) return;
  if(selTo){
    box.className = "card rar-"+selTo.rar;
    box.innerHTML = `<div class="rarity-dot"></div><div class="skin-ico">${skinMedia(selTo)}</div><div class="skin-name">${esc(selTo.name)}</div><div class="skin-price">${fmt(selTo.price)}</div>`;
  } else if(selFrom){
    const T = selFrom.price * (100/chance);
    box.className = "card locked";
    box.innerHTML = `<div class="card-empty">Награда ≈ <b>${fmt(T)}</b><br>выбери скин в пуле ↓</div>`;
  } else {
    box.className = "card locked";
    box.innerHTML = `<div class="card-empty">Выбери скин<br>целью ↓</div>`;
  }
}

/* ---------- пул целей ---------- */
function renderPool(){
  const grid = $("#pool-grid");
  if(!grid) return;

  let list;
  if(selFrom){
    const w = targetWindow();
    const T = selFrom.price * (100/chance);
    list = SKINS.map((s,i)=>({...s, idx:i}))
      .filter(s => s.price >= w.lo && s.price <= w.hi)
      .sort((a,b)=> Math.abs(a.price-T) - Math.abs(b.price-T));
    if(!list.length){
      if(grid.dataset.lsig !== "empty"){
        grid.dataset.lsig = "empty";
        grid.innerHTML = `<div class="card locked rar-blue"><div class="card-empty">Нет подходящих целей.<br>Измени шанс или скин.</div></div>`;
      }
      return;
    }
  } else {
    list = SKINS.map((s,i)=>({...s, idx:i})).sort((a,b)=>a.price-b.price);
  }

  /* не пересобираем DOM без необходимости — перетаскивание колеса на каждый кадр
     перестраивало 48 карточек (с перезагрузкой картинок) и лагало */
  const listSig = list.map(s=>s.idx).join(",");
  const selName = selTo ? selTo.name : "";
  if(grid.dataset.lsig === listSig){
    if(grid.dataset.ssig !== selName){          // состав тот же — переключаем только выделение
      grid.dataset.ssig = selName;
      $$("#pool-grid .card[data-idx]").forEach(c=>{
        const s = list.find(x=>x.idx === +c.dataset.idx);
        c.classList.toggle("selected", !!(selTo && s && selTo.name === s.name));
      });
    }
    return;
  }
  grid.dataset.lsig = listSig;
  grid.dataset.ssig = selName;

  grid.innerHTML = list.map(s=>`
    <div class="card rar-${s.rar}${selTo && selTo.name===s.name ? " selected":""}" data-idx="${s.idx}">
      <div class="rarity-dot"></div>
      <div class="skin-ico">${skinMedia(s)}</div>
      <div class="skin-name">${esc(s.name)}</div>
      <div class="skin-price">${fmt(s.price)}</div>
    </div>`).join("");
  $$("#pool-grid .card[data-idx]").forEach(c=>{
    c.addEventListener("click", ()=> selectTo(+c.dataset.idx));
  });
  const pt = $("#pool-total");
  if(pt) pt.textContent = SKINS.length;
}

/* ---------- инвентарь ---------- */
let invFilter = "all";
function renderInv(){
  const grid = $("#inv-grid");
  if(!grid) return;
  const list = DB.inv.filter(x => invFilter==="all" || x.rar===invFilter).slice().reverse();
  grid.innerHTML = list.map(x=>skinCard(x,{selected: selFrom && selFrom.id===x.id})).join("");
  $$("#inv-grid .card").forEach(c=>{
    c.addEventListener("click", ()=> selectFrom(+c.dataset.id));
  });
  $("#inv-empty").hidden = DB.inv.length > 0;
  const badge = $("#inv-badge");
  if(badge) badge.textContent = `🎒 ${DB.inv.length} шт · ${fmt(invSum())}`;
}

/* ---------- кнопка спина ---------- */
function updateSpinBtn(){
  const btn = $("#spin-btn");
  if(!btn) return;
  if(spinning){ btn.disabled = true; btn.textContent = "Крутим..."; return; }
  if(!selFrom || !selTo){
    btn.disabled = true;
    btn.textContent = !selFrom && !selTo ? "Выбери оба скина" : (!selFrom ? "Выбери свой скин ↓" : "Выбери цель в пуле ↓");
    return;
  }
  btn.disabled = false;
  btn.textContent = `Апгрейд ${chance}% · ${fmt(selFrom.price)} → ${fmt(selTo.price)}`;
}

/* ---------- СПИН: стрелка по колесу ---------- */
function setNeedle(deg){
  wheelAngle = ((deg % 360) + 360) % 360;
  /* CSS transform вместо SVG-атрибута: кадр крутится на GPU-слое,
     весь SVG не перерисовывается — это и убирает лаги анимации */
  const n = $("#needle");
  if(n) n.style.transform = `rotate(${wheelAngle}deg)`;
}

/* исход: выигрыш, если стрелка попала в зону [0°, ch*3.6°) от 12 часов по часовой */
function angleWon(angle, ch){
  return angle < ch*3.6;
}

async function spin(){
  if(!selFrom || !selTo || spinning) return;
  spinning = true;
  /* фиксируем все параметры на момент ставки — изменения интерфейса
     во время прокрута не должны влиять на исход */
  const from = selFrom;
  const targetDef = selTo;
  const spinChance = chance;
  const wheelEl = $("#wheel");
  if(wheelEl) wheelEl.classList.add("spinning");
  updateSpinBtn();
  Sound.launch();

  /* --- честный исход: заранее решаем, куда должна упасть стрелка --- */
  const win = Math.random()*100 < spinChance;
  const zoneEnd = spinChance*3.6;             // конец зелёной зоны
  const finalAngle = win
    ? Math.random() * (zoneEnd - 2) + 1       // внутри зоны (не на самой границе)
    : zoneEnd + Math.random() * (360 - zoneEnd - 2) + 1;

  /* --- анимация: 5-7 полных оборотов + доводка до finalAngle --- */
  const turns = 5 + Math.floor(Math.random()*3);   // 5..7 оборотов
  const startAngle = wheelAngle;
  let normalizedStart = startAngle;
  const targetAbsolute = turns*360 + finalAngle;
  const delta = targetAbsolute - normalizedStart;

  const DURATION = 4200;
  const t0 = performance.now();
  let lastTickAngle = startAngle;              // для звука трещотки
  let lastTickTime = 0;

  function easeOutQuint(t){ return 1 - Math.pow(1-t, 5); }

  await new Promise(resolve=>{
    function frame(now){
      const t = Math.min(1, (now - t0)/DURATION);
      const cur = normalizedStart + delta * easeOutQuint(t);
      /* трещотка: ритм зависит от фазы вращения —
         в первую секунду щедро (~60мс), к остановке лениво (~300мс) */
      const minGap = 60 + 260 * Math.pow(t, 1.5);
      if(Math.abs(cur - lastTickAngle) >= 18 && now - lastTickTime >= minGap){
        lastTickAngle = cur;
        lastTickTime = now;
        Sound.tick(1 - t);
      }
      setNeedle(cur);
      if(t < 1) requestAnimationFrame(frame);
      else { setNeedle(finalAngle); resolve(); }
    }
    requestAnimationFrame(frame);
  });

  /* --- результат: по зафиксированным на старте значениям --- */
  const wonFinal = angleWon(finalAngle, spinChance);
  const cardTo = $("#card-to");
  if(cardTo) cardTo.classList.add(wonFinal ? "flash-win" : "flash-lose");

  removeItem(from.id);
  DB.stats.total++;
  if(wonFinal){
    DB.stats.wins++;
    DB.stats.won += targetDef.price;
    Sound.win();
    const got = addItem(targetDef);
    addHistory(true, targetDef.price, from, targetDef);
    renderInv();
    showWin(got);
  } else {
    DB.stats.losses++;
    DB.stats.lost += from.price;
    Sound.lose();
    addHistory(false, from.price, from, targetDef);
    renderInv();
    toast(`Апгрейд провален — ${from.name} потерян`,"err");
  }
  /* локальное сохранение + атомарные инкременты глобальной статистики в облако
     (если Firebase подключен; иначе это просто saveDB) */
  Cloud.bumpStats({
    total: 1,
    wins:   wonFinal ? 1 : 0,
    losses: wonFinal ? 0 : 1,
    won:    wonFinal ? targetDef.price : 0,
    lost:   wonFinal ? 0 : from.price
  });

  spinning = false;
  if(wheelEl) wheelEl.classList.remove("spinning");
  selFrom = null; selTo = null;
  renderFrom(); renderTo(); renderPool(); updateSpinBtn();
  renderInv();
  setTimeout(()=>{ if(cardTo) cardTo.classList.remove("flash-win","flash-lose"); }, 2500);
}

function addHistory(win, price, from, to){
  const h = $("#up-history");
  if(!h) return;
  const chip = document.createElement("div");
  chip.className = "hist-chip " + (win?"won":"lost");
  chip.innerHTML = `${win?"✅":"❌"} <span>${esc(from.name)}</span> <span class="hm">→</span> <span>${esc(to.name)}</span> <b>${fmt(price)}</b>`;
  h.prepend(chip);
  while(h.children.length > 6) h.lastChild.remove();
}

function showWin(item){
  const m = $("#win-modal");
  if(!m) return;
  $("#win-card").innerHTML = skinCard(item);
  m.hidden = false;
}
function closeWinModal(){ const m=$("#win-modal"); if(m) m.hidden = true; }

/* ---------- мини-админ из игры ---------- */
/* PIN хранится только как SHA-256 хеш — в репе и в коде сайта его нет.
   Смена PIN: на https-странице сайта открой консоль (F12) и выполни
     const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("новыйПИН"));
     [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("")
   и вставь полученную строку в ADMIN_PIN_HASH.
   Локальный вариант: создай файл admin-pin.js (он в .gitignore) со строкой
     var ADMIN_PIN = "твойПИН";
   и подключи его в admin.html/upgrade.html — в репу он не попадёт. */
var ADMIN_PIN_HASH = "acc2c51a6cd1b067523df47e10a263c678dcd59b76aa31446fc764c104595553";

async function sha256hex(text){
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* локальный override (admin-pin.js) или хеш */
async function checkAdminPin(text){
  if(typeof ADMIN_PIN !== "undefined" && ADMIN_PIN === text) return true;
  try{ return await sha256hex(text) === ADMIN_PIN_HASH; }catch(e){ return false; }
}

function openAdminModal(){
  const m = $("#admin-modal");
  if(!m) return;
  m.hidden = false;
  $("#admin-pin").focus();
}
function closeAdminModal(){ const m=$("#admin-modal"); if(m) m.hidden = true; }
function tryAdminLogin(){
  const p = $("#admin-pin");
  if(!p) return;
  checkAdminPin(p.value).then(ok=>{
    if(ok){
      closeAdminModal();
      toast("Админ-режим: выдача скинов на стр. админа","ok");
      setTimeout(()=>{ location.href = "admin.html"; }, 800);
    } else {
      toast("Неверный PIN","err");
    }
  });
}

/* ---------- фильтры инвентаря ---------- */
function initFilters(){
  $$(".inv-filter .btn").forEach(b=>{
    b.addEventListener("click", ()=>{
      $$(".inv-filter .btn").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      invFilter = b.dataset.rar;
      renderInv();
    });
  });
}

/* ---------- boot ---------- */
function renderAll(){
  renderFrom(); renderTo(); renderPool(); renderInv(); updateSpinBtn();
}

function boot(){
  chanceUIInit();
  drawWheelZone();   // без этого при загрузке колесо показывает 100% зону до первого клика по шансу
  initFilters();
  const st = $("#sound-toggle");
  if(st) st.textContent = Sound.enabled ? "🔊" : "🔇";
  renderAll();
  const sb = $("#spin-btn");
  if(sb) sb.addEventListener("click", spin);

  /* облачная синхронизация: когда подтянется инвентарь из Firebase — перерисовать */
  Cloud.init();
  Cloud.on("synced", renderAll);
}
document.addEventListener("DOMContentLoaded", boot);
