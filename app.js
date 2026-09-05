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
      if(typeof db.balance !== "number" || !isFinite(db.balance)) db.balance = 0;
      return db;
    }
  }catch(e){}
  return { inv:[], balance:0, stats:{ total:0, wins:0, losses:0, won:0, lost:0 }, uid:1 };
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

/* ---------- баланс / продажа / покупка ---------- */
function sellPrice(item){ return Math.max(0.01, Math.round(item.price*0.85*100)/100); }
function buyPrice(s){ return Math.max(0.01, Math.round(s.price*1.10*100)/100); }

function renderBalance(){
  const b = $("#bal-badge");
  if(b) b.textContent = "💰 " + fmt(DB.balance);
}

function sellItem(id){
  if(spinning) return;                     // во время прокрута инвентарь трогать нельзя
  const item = DB.inv.find(x=>x.id===id);
  if(!item) return;
  const price = sellPrice(item);
  if(selFromItems.some(x=>x.id===id)){ selFromItems = selFromItems.filter(x=>x.id!==id); selTo = null; }
  removeItem(id);
  DB.balance = Math.round((DB.balance + price)*100)/100;
  Sound.click();
  toast(`Продано: ${item.name} — +${fmt(price)}`,"ok");
  renderFrom(); renderTo(); renderPool(); renderInv(); renderBalance();
}

function buySkin(idx){
  if(spinning) return;
  const def = SKINS[idx];
  if(!def) return;
  const price = buyPrice(def);
  if(DB.balance < price){
    toast(`Не хватает ${fmt(price - DB.balance)} на ${def.name}`,"err");
    return;
  }
  DB.balance = Math.round((DB.balance - price)*100)/100;
  addItem(def);
  Sound.select();
  toast(`Куплено: ${def.name} за ${fmt(price)}`,"ok");
  renderInv(); renderBalance();
}

function renderShop(){
  const grid = $("#shop-grid");
  if(!grid) return;
  const q = shopQuery.trim().toLowerCase();
  const list = SKINS.map((s,i)=>({...s, idx:i}))
    .filter(s => !q || s.name.toLowerCase().includes(q))
    .sort((a,b)=>a.price-b.price);
  const visible = list.slice(0, shopShown);
  grid.innerHTML = visible.map(s=>`
    <div class="card rar-${s.rar} shop-card" data-idx="${s.idx}" title="Купить за ${fmt(buyPrice(s))}">
      <div class="rarity-dot"></div>
      <div class="skin-ico">${skinMedia(s)}</div>
      <div class="skin-name">${esc(s.name)}</div>
      <div class="skin-price">${fmt(buyPrice(s))}</div>
      <div class="buy-chip">Купить</div>
    </div>`).join("");
  $$("#shop-grid .card").forEach(c=>{
    c.addEventListener("click", ()=> buySkin(+c.dataset.idx));
  });
  const count = $("#shop-count");
  if(count) count.textContent = list.length;
  const more = $("#shop-more-wrap");
  if(more) more.hidden = visible.length >= list.length;
}

let shopShown = 60, shopQuery = "";
const SHOP_PAGE = 120;

function shopSearchDebounced(v){
  clearTimeout(shopSearchDebounced.t);
  shopSearchDebounced.t = setTimeout(()=>{
    shopQuery = v;
    shopShown = 60;
    renderShop();
  }, 250);
}

function initShopControls(){
  const inp = $("#shop-search");
  if(inp) inp.addEventListener("input", ()=>{
    shopSearchDebounced(inp.value);
    /* поиск имеет смысл только в магазине — переключаем вкладку сама */
    if(rightTab !== "shop" || mobileTab === "pool"){
      rightTab = "shop";
      if(mobileTab === "pool") mobileTab = "shop";
      syncPanels();
    }
  });
  const more = $("#shop-more");
  if(more) more.addEventListener("click", ()=>{ shopShown += SHOP_PAGE; renderShop(); });
}

/* ---------- вкладки панелей (инвентарь / цели / магазин) ---------- */
let mobileTab = "inv", rightTab = "pool";

function syncPanels(){
  const phone = matchMedia("(max-width:900px)").matches;
  const tabs = $("#panel-tabs-phone");
  if(tabs) tabs.hidden = !phone;
  if(phone){
    $("#panel-inv").classList.toggle("active", mobileTab === "inv");
    $("#panel-right").classList.toggle("active", mobileTab !== "inv");
    $("#pool-wrap").hidden = mobileTab !== "pool";
    $("#shop-wrap").hidden = mobileTab !== "shop";
    $$("#panel-tabs-phone .ptab").forEach(b=>b.classList.toggle("active", b.dataset.t === mobileTab));
  } else {
    $("#panel-inv").classList.add("active");
    $("#panel-right").classList.add("active");
    $("#pool-wrap").hidden = rightTab !== "pool";
    $("#shop-wrap").hidden = rightTab !== "shop";
    $$(".rt-btn").forEach(b=>b.classList.toggle("active", b.dataset.rt === rightTab));
  }
  /* вкладка стала видимой — перерисовать (ленивые картинки) */
  if(!$("#shop-wrap").hidden) renderShop();
}

function initPanels(){
  $$("#panel-tabs-phone .ptab").forEach(b=>{
    b.addEventListener("click", ()=>{
      mobileTab = b.dataset.t;
      Sound.click();
      syncPanels();
    });
  });
  $$(".rt-btn").forEach(b=>{
    b.addEventListener("click", ()=>{
      rightTab = b.dataset.rt;
      Sound.click();
      syncPanels();
    });
  });
  matchMedia("(max-width:900px)").addEventListener("change", syncPanels);
  syncPanels();
}

function skinCard(item, opts={}){
  const cls = ["card","rar-"+item.rar];
  if(opts.selected) cls.push("selected");
  /* чип продажи — только в инвентаре */
  const sell = opts.sellable
    ? `<button class="sell-chip" data-id="${item.id}" title="Продать за ${fmt(sellPrice(item))}">$</button>`
    : "";
  return `<div class="${cls.join(" ")}" data-id="${item.id}">
    <div class="rarity-dot"></div>
    ${sell}
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
let selFromItems = [];   // скины из инвентаря (ставка — можно несколько)
let selTo = null;        // цель из каталога (награда)
let spinning = false;
let chance = 50;
let wheelAngle = 0;   // текущий угол стрелки (градусы)
let autoPick = true;  // автоподбор цели под выбранный шанс

function betTotal(){ return selFromItems.reduce((s,x)=>s+x.price,0); }
function plural(n, one, few, many){
  const d = n % 10;
  if(n % 100 > 19 || n % 100 < 10){
    if(d === 1) return one;
    if(d >= 2 && d <= 4) return few;
  }
  return many;
}
function betLabel(items){
  const n = items.length;
  return n === 1 ? items[0].name : `${n} ${plural(n,"скин","скина","скинов")} · ${fmt(betTotal())}`;
}

/* окно допустимых цен цели: [T*0.45 .. T*1.3], где T = ставка × множитель */
function targetWindow(){
  const from = selFromItems.length ? betTotal() : 0;
  const T = from * (100/chance);
  return { lo: Math.max(from*1.05, T*0.45), hi: T*1.3 };
}
function fairChance(fromPrice, toPrice){
  return Math.max(5, Math.min(95, Math.floor(fromPrice/toPrice*100)));
}

/* автоподбор: цель из окна допустимых, ближайшая по цене к T = ставка × множитель */
function autoPickTarget(){
  if(!selFromItems.length) return null;
  const w = targetWindow();
  const T = betTotal() * (100/chance);
  const cands = SKINS.filter(s => s.price >= w.lo && s.price <= w.hi);
  if(!cands.length) return null;
  return cands.reduce((a,b)=> Math.abs(a.price-T) <= Math.abs(b.price-T) ? a : b);
}

function applyAutoPick(){
  if(!autoPick || !selFromItems.length) return false;
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
      if(autoPick && selFromItems.length){
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
  if(opts.resetTarget && selFromItems.length && autoPick){
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
  if(selFromItems.some(x=>x.id===id)){        // повторный клик — убрать скин из ставки
    selFromItems = selFromItems.filter(x=>x.id!==id);
    if(!selFromItems.length) selTo = null;
  } else {
    selFromItems.push(item);
    if(autoPick){
      applyAutoPick();                        // пересчитать цель под новую сумму
    } else if(selTo && fairChance(betTotal(), selTo.price) < 5){
      selTo = null;
      toast("Сумма ставки изменилась — эта цель больше не подходит","err");
    }
  }
  renderFrom(); renderTo(); renderPool(); renderInv(); updateSpinBtn();
}

function renderFrom(){
  const box = $("#card-from");
  if(!box) return;
  const items = selFromItems;
  if(!items.length){
    box.className = "card locked";
    box.innerHTML = `Выбери скины<br>в «Моих скинах»`;
    return;
  }
  if(items.length === 1){
    const it = items[0];
    box.className = "card rar-"+it.rar;
    box.innerHTML = `<div class="rarity-dot"></div><div class="skin-ico">${skinMedia(it)}</div><div class="skin-name">${esc(it.name)}</div><div class="skin-price">${fmt(it.price)}</div>`;
    return;
  }
  /* стек выбранных скинов: до трёх картинок внахлёст */
  const top = [...items].sort((a,b)=>b.price-a.price)[0];
  box.className = "card rar-"+top.rar;
  const stack = items.slice(0,3).map(x=>`<img class="skin-img" src="${esc(x.img||"")}" alt="" draggable="false">`).join("");
  box.innerHTML = `<div class="rarity-dot"></div><div class="skin-ico stack">${stack}</div><div class="skin-name">${items.length} ${plural(items.length,"скин","скина","скинов")}</div><div class="skin-price">${fmt(betTotal())}</div>`;
}

/* ---------- выбор цели ---------- */
function selectTo(idx){
  if(spinning) return;
  const def = SKINS[idx];
  if(!def) return;
  if(!selFromItems.length){ toast("Сначала выбери скины в «Моих скинах»","err"); return; }
  if(selTo && selTo.name === def.name){ selTo = null; }   // повторный клик — снять
  else if(def.price <= betTotal()*1.05){ toast("Цель должна быть дороже ставки","err"); return; }
  else if(fairChance(betTotal(), def.price) < 5){ toast("Слишком дорогая цель для этой ставки","err"); return; }
  else {
    Sound.select();
    autoPick = false;                              // ручной выбор отключает автоподбор
    syncAutoToggle();
    selTo = def;
    chance = fairChance(betTotal(), def.price);   // честный шанс из цен
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
  } else if(selFromItems.length){
    const T = betTotal() * (100/chance);
    box.className = "card locked";
    box.innerHTML = `Награда ≈ <b>${fmt(T)}</b><br>выбери во «Целях»`;
  } else {
    box.className = "card locked";
    box.innerHTML = `Выбери цель<br>во «Целях»`;
  }
}

/* ---------- пул целей ---------- */
const POOL_LIMIT = 60;   // сколько ближайших целей показываем (в каталоге теперь тысячи скинов)

function renderPool(){
  const grid = $("#pool-grid");
  if(!grid) return;

  let list, note = "";
  if(selFromItems.length){
    const w = targetWindow();
    const T = betTotal() * (100/chance);
    list = SKINS.map((s,i)=>({...s, idx:i}))
      .filter(s => s.price >= w.lo && s.price <= w.hi)
      .sort((a,b)=> Math.abs(a.price-T) - Math.abs(b.price-T));
    const total = list.length;
    list = list.slice(0, POOL_LIMIT);
    if(total > POOL_LIMIT) note = `ближайшие ${POOL_LIMIT} из ${total} подходящих`;
  } else {
    list = SKINS.map((s,i)=>({...s, idx:i})).sort((a,b)=>a.price-b.price);
    const total = list.length;
    list = list.slice(0, POOL_LIMIT);
    if(total > POOL_LIMIT) note = `${POOL_LIMIT} самых дешёвых из ${total} — выбери ставку, чтобы сузить`;
  }

  /* не пересобираем DOM без необходимости — перетаскивание колеса на каждый кадр
     перестраивало карточки (с перезагрузкой картинок) и лагало */
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
    const noteEl = $("#pool-note");
    if(noteEl && noteEl.textContent !== note) noteEl.textContent = note;
    return;
  }
  grid.dataset.lsig = listSig;
  grid.dataset.ssig = selName;

  const noteEl = $("#pool-note");
  if(noteEl) noteEl.textContent = note;

  if(!list.length){
    grid.innerHTML = `<div class="card locked rar-blue"><div class="card-empty">Нет подходящих целей.<br>Измени шанс или скин.</div></div>`;
    return;
  }

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
  grid.innerHTML = list.map(x=>skinCard(x,{selected: selFromItems.some(i=>i.id===x.id), sellable:true})).join("");
  $$("#inv-grid .card").forEach(c=>{
    c.addEventListener("click", ()=> selectFrom(+c.dataset.id));
  });
  $$("#inv-grid .sell-chip").forEach(ch=>{
    ch.addEventListener("click", e=>{
      e.stopPropagation();
      sellItem(+ch.dataset.id);
    });
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
  const hasBet = selFromItems.length > 0;
  if(!hasBet || !selTo){
    btn.disabled = true;
    btn.textContent = !hasBet && !selTo ? "Выбери скины для ставки" : (!hasBet ? "Выбери свои скины ↓" : "Выбери цель ↓");
    return;
  }
  btn.disabled = false;
  btn.textContent = `Апгрейд ${chance}% · ${fmt(betTotal())} → ${fmt(selTo.price)}`;
}

/* ---------- СПИН: стрелка по колесу ---------- */
let needleEl = null;
function setNeedle(deg){
  wheelAngle = ((deg % 360) + 360) % 360;
  /* стрелка — HTML-слой поверх SVG: кадр крутится на GPU-слое (важно для Safari,
     который не композитит SVG-элементы), весь SVG не перерисовывается */
  if(!needleEl) needleEl = $("#needle");
  if(needleEl) needleEl.style.transform = `rotate(${wheelAngle}deg)`;
}

/* исход: выигрыш, если стрелка попала в зону [0°, ch*3.6°) от 12 часов по часовой */
function angleWon(angle, ch){
  return angle < ch*3.6;
}

async function spin(){
  if(!selFromItems.length || !selTo || spinning) return;
  spinning = true;
  /* фиксируем все параметры на момент ставки — изменения интерфейса
     во время прокрута не должны влиять на исход */
  const fromItems = [...selFromItems];
  const bet = betTotal();
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

  function easeOutQuint(t){ return 1 - Math.pow(1-t, 5); }

  /* --- трещотка: весь ряд щелчков считается заранее и планируется на аудио-часах.
     Звук идёт по своим часам с точностью до сэмпла и не отстаёт от анимации,
     даже если Safari притормаживает основной поток --- */
  {
    let lastTickAngle = startAngle, lastTickTime = -Infinity;
    const times = [];
    const STEP = 20;   // шаг симуляции траектории, мс
    for(let ms = 0; ms <= DURATION; ms += STEP){
      const t = ms/DURATION;
      const cur = normalizedStart + delta * easeOutQuint(t);
      const minGap = 60 + 260 * Math.pow(t, 1.5);
      if(Math.abs(cur - lastTickAngle) >= 18 && ms - lastTickTime >= minGap){
        lastTickAngle = cur;
        lastTickTime = ms;
        times.push({ at: ms/1000, speed: 1 - t });
      }
    }
    Sound.scheduleTicks(times);
  }

  /* --- вращение через Web Animations API: Safari выполняет такие анимации
     целиком на композиторе — основной поток и rAF не участвуют, поэтому
     нагрузка страницы (и запись инспектора) не дёргает стрелку.
     40 ключевых кадров = кусочно-линейная аппроксимация easeOutQuint,
     тайминги совпадают с рядом щелчков --- */
  {
    const SEG = 40;
    const keyframes = [];
    for(let i = 0; i <= SEG; i++){
      const t = i/SEG;
      keyframes.push({ transform: `rotate(${(normalizedStart + delta*easeOutQuint(t)).toFixed(2)}deg)`, offset: t });
    }
    needleEl = $("#needle");
    const anim = needleEl.animate(keyframes, { duration: DURATION, easing: "linear", fill: "forwards" });
    await new Promise(r => setTimeout(r, DURATION + 60));
    anim.cancel();
    setNeedle(finalAngle);
  }

  /* --- результат: по зафиксированным на старте значениям --- */
  const wonFinal = angleWon(finalAngle, spinChance);
  const cardTo = $("#card-to");
  if(cardTo) cardTo.classList.add(wonFinal ? "flash-win" : "flash-lose");

  fromItems.forEach(x => removeItem(x.id));   // ставка уходит целиком
  DB.stats.total++;
  if(wonFinal){
    DB.stats.wins++;
    DB.stats.won += targetDef.price;
    Sound.win();
    const got = addItem(targetDef);
    addHistory(true, targetDef.price, betLabel(fromItems), targetDef);
    renderInv();
    showWin(got);
  } else {
    DB.stats.losses++;
    DB.stats.lost += bet;
    Sound.lose();
    addHistory(false, bet, betLabel(fromItems), targetDef);
    renderInv();
    toast(`Апгрейд провален — ${fromItems.length} ${plural(fromItems.length,"скин","скина","скинов")} потеряно (${fmt(bet)})`,"err");
  }
  /* локальное сохранение + атомарные инкременты глобальной статистики в облако
     (если Firebase подключен; иначе это просто saveDB) */
  Cloud.bumpStats({
    total: 1,
    wins:   wonFinal ? 1 : 0,
    losses: wonFinal ? 0 : 1,
    won:    wonFinal ? targetDef.price : 0,
    lost:   wonFinal ? 0 : bet
  });

  spinning = false;
  if(wheelEl) wheelEl.classList.remove("spinning");
  selFromItems = []; selTo = null;
  renderFrom(); renderTo(); renderPool(); updateSpinBtn();
  renderInv();
  setTimeout(()=>{ if(cardTo) cardTo.classList.remove("flash-win","flash-lose"); }, 2500);
}

function addHistory(win, price, fromLabel, to){
  const h = $("#up-history");
  if(!h) return;
  const chip = document.createElement("div");
  chip.className = "hist-chip " + (win?"won":"lost");
  chip.innerHTML = `${win?"✅":"❌"} <span>${esc(fromLabel)}</span> <span class="hm">→</span> <span>${esc(to.name)}</span> <b>${fmt(price)}</b>`;
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
  renderFrom(); renderTo(); renderPool(); renderInv(); renderShop(); renderBalance(); updateSpinBtn();
}

function boot(){
  chanceUIInit();
  drawWheelZone();   // без этого при загрузке колесо показывает 100% зону до первого клика по шансу
  initFilters();
  initShopControls();
  initPanels();
  const st = $("#sound-toggle");
  if(st){
    st.textContent = Sound.enabled ? "🔊" : "🔇";
    st.classList.toggle("sound-off", !Sound.enabled);
    if(!Sound.enabled && $("#spin-btn")){
      toast("Звук выключен — нажми 🔇 в шапке, чтобы включить","err");
    }
  }
  renderAll();
  const sb = $("#spin-btn");
  if(sb) sb.addEventListener("click", spin);

  /* спрятал вкладку — запланированные щелчки глушим (анимация-то остановилась) */
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) Sound.cancelTicks();
  });

  /* облачная синхронизация: когда подтянется инвентарь из Firebase — перерисовать */
  Cloud.init();
  Cloud.on("synced", renderAll);
}
document.addEventListener("DOMContentLoaded", boot);
