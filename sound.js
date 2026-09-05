/* ===== drennydrop — звуки (Web Audio API, без аудиофайлов) ===== */
/* Палитра: мягкие щелчки и треск на фильтрованном шуме, приглушённые тона.
   Всё сильно отфильтровано lowpass'ом и занижено по громкости — не бьёт по ушам. */

const Sound = (() => {
  const KEY = "fragdrop_sound";
  const TICK_KEY = "fragdrop_tick_style";
  /* варианты тембра трещотки: чистые короткие синус-клики без шума */
  const TICK_STYLES = [
    { id:"mech", name:"Механика — сухой клик храповика" },
    { id:"wood", name:"Дерево — глухой стук" },
    { id:"soft", name:"Тихий — еле слышный тик" },
  ];
  let tickStyle = "mech";
  try{ tickStyle = localStorage.getItem(TICK_KEY) || "mech"; }catch(e){}
  let enabled = true;
  try{ enabled = localStorage.getItem(KEY) !== "0"; }catch(e){}
  let ctx = null;

  /* контекст создаётся лениво — только после жеста пользователя (политика автовоспроизведения) */
  function ac(){
    if(!enabled) return null;
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
    }
    if(ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* огибающая атаки-затухания, чтобы щелчки не «стреляли» */
  function env(gain, t, attack, decay, peak){
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function tone({freq=440, type="sine", dur=0.15, peak=0.2, delay=0, slide=null, lp=null}){
    const c = ac(); if(!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    env(g, t, 0.012, dur, peak);
    o.connect(g);
    let out = g;
    if(lp){ const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; out.connect(f); out = f; }
    out.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.06);
  }

  function noise({dur=0.1, peak=0.15, delay=0, hp=2000, lp=8000}){
    const c = ac(); if(!c) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = Math.random()*2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const hpF = c.createBiquadFilter(); hpF.type = "highpass"; hpF.frequency.value = hp;
    const lpF = c.createBiquadFilter(); lpF.type = "lowpass"; lpF.frequency.value = lp;
    const g = c.createGain(); env(g, t, 0.006, dur, peak);
    src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(c.destination);
    src.start(t);
  }

  /* буфер щелчка рендерится один раз; каждый тик — один BufferSource.
     Создание осцилляторов и фильтров на каждый тик давало микрофризы в Safari */
  let tickBuf = null;
  function tickBuffer(c){
    if(tickBuf) return tickBuf;
    const dur = 0.03;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    tickBuf = c.createBuffer(1, len, c.sampleRate);
    const d = tickBuf.getChannelData(0);
    for(let i=0;i<len;i++){
      const t = i/len;
      d[i] = Math.sin(2*Math.PI*1750*(t*dur)) * (1-t)*(1-t) * 0.6;
    }
    return tickBuf;
  }

  /* весь ряд щелчков планируем на аудио-часах заранее, но порциями (lookahead):
     разовое создание ~50 узлов в кадре старта давало всплеск в WebKit */
  let scheduledTicks = [];
  let tickQueue = [], tickPos = 0, tickBase = 0, tickTimer = null;

  function makeTickSource(at, speed){
    const src = ctx.createBufferSource();
    src.buffer = tickBuffer(ctx);
    let base = 1750;                            // mech
    if(tickStyle === "wood") base = 1150;
    else if(tickStyle === "soft") base = 800;
    src.playbackRate.value = (base/1750) * (0.88 + 0.24*speed);
    const g = ctx.createGain();
    g.gain.value = (tickStyle === "soft" ? 0.55 : 0.9) * (0.5 + 0.5*speed);
    src.connect(g); g.connect(ctx.destination);
    src.start(at);
    scheduledTicks.push(src);
  }
  function pumpTicks(){
    if(!ctx || tickPos >= tickQueue.length) return;
    const horizon = ctx.currentTime + 0.3;      // держим ~300мс запаса
    while(tickPos < tickQueue.length && tickBase + tickQueue[tickPos].at <= horizon){
      const it = tickQueue[tickPos++];
      makeTickSource(tickBase + it.at, it.speed);
    }
    if(tickPos < tickQueue.length){
      tickTimer = setTimeout(pumpTicks, 100);
    }
  }
  function scheduleTicks(times){
    const c = ac(); if(!c) return 0;
    cancelTicks();
    tickQueue = times; tickPos = 0;
    tickBase = c.currentTime + 0.06;
    pumpTicks();
    return times.length;
  }
  function cancelTicks(){
    if(tickTimer){ clearTimeout(tickTimer); tickTimer = null; }
    scheduledTicks.forEach(s=>{ try{ s.stop(); }catch(e){} });
    scheduledTicks = [];
  }

  return {
    get enabled(){ return enabled; },
    toggle(){
      enabled = !enabled;
      try{ localStorage.setItem(KEY, enabled ? "1" : "0"); }catch(e){}
      if(enabled) this.click();
      return enabled;
    },
    /* клик по кнопке/пресету — сухой мягкий тап по дереву */
    click(){
      noise({dur:0.02, peak:0.04, hp:1200, lp:5000});
      tone({freq:290, type:"sine", dur:0.05, peak:0.05, lp:1200});
    },
    /* выбор скина — два приглушённых маримба-нота */
    select(){
      tone({freq:440, type:"sine", dur:0.14, peak:0.06, lp:2400});
      tone({freq:587, type:"sine", dur:0.16, peak:0.05, delay:0.08, lp:2400});
    },
    /* разовый тик (превью тембра на кнопке 🎚) */
    tick(speed=1){
      const c = ac(); if(!c) return;
      const buf = tickBuffer(c);
      const src = c.createBufferSource();
      src.buffer = buf;
      let base = 1750;                            // mech
      if(tickStyle === "wood") base = 1150;
      else if(tickStyle === "soft") base = 800;
      src.playbackRate.value = (base/1750) * (0.88 + 0.24*speed);
      const g = c.createGain();
      g.gain.value = (tickStyle === "soft" ? 0.55 : 0.9) * (0.5 + 0.5*speed);
      src.connect(g); g.connect(c.destination);
      src.start();
    },
    /* заранее спланировать весь ряд щелчков спина на аудио-часах */
    scheduleTicks,
    cancelTicks,
    /* явно закрыть аудиоконтекст (при уходе со страницы) */
    close(){
      if(ctx){
        try{ ctx.close(); }catch(e){}
        ctx = null;
      }
    },
    get tickStyle(){ return tickStyle; },
    tickStyleName(){
      const s = TICK_STYLES.find(x=>x.id===tickStyle);
      return s ? s.name : tickStyle;
    },
    cycleTickStyle(){
      const i = TICK_STYLES.findIndex(x=>x.id===tickStyle);
      tickStyle = TICK_STYLES[(i+1) % TICK_STYLES.length].id;
      try{ localStorage.setItem(TICK_KEY, tickStyle); }catch(e){}
      this.tick(1); this.tick(0.3);
      return this.tickStyleName();
    },
    /* запуск колеса — тихий «вздох» воздуха */
    launch(){
      noise({dur:0.4, peak:0.03, hp:250, lp:1800});
    },
    win(){
      /* нежные колокольчики: основной тон + тихая обертона */
      [523.25, 659.25, 783.99, 1046.5].forEach((f,i)=>{
        tone({freq:f, type:"sine", dur:0.6, peak:0.075, delay:i*0.13, lp:3200});
        tone({freq:f*2, type:"sine", dur:0.35, peak:0.02, delay:i*0.13, lp:5000});
      });
    },
    lose(){
      /* глухой мягкий «упс»: два тихих низких тона без резкости */
      tone({freq:196, type:"sine", dur:0.45, peak:0.06, slide:150, lp:700});
      tone({freq:98, type:"sine", dur:0.55, peak:0.05, delay:0.16, slide:75, lp:500});
      noise({dur:0.12, peak:0.02, delay:0.02, hp:300, lp:900});
    }
  };
})();

/* переключатель в шапке (иконка обновляется в boot) */
function toggleSound(){
  const on = Sound.toggle();
  if(!on) Sound.cancelTicks();   // выключил звук посреди прокрута — щелчки глушим
  const b = document.querySelector("#sound-toggle");
  if(b) b.textContent = on ? "🔊" : "🔇";
}

/* перебор тембров трещотки (кнопка в шапке) */
function cycleTickSound(){
  const name = Sound.cycleTickStyle();
  if(window.toast) toast("Трещотка: " + name, "ok");
}

/* при перезагрузке/уходе со страницы явно закрываем аудиоконтекст.
   Иначе Safari macOS прикрепляет новую страницу к старому аудио-маршруту
   с огромной задержкой — помогало только полное закрытие вкладки */
function closeAudioContext(){
  if(typeof Sound !== "undefined") Sound.close();
}
window.addEventListener("pagehide", closeAudioContext);
window.addEventListener("beforeunload", closeAudioContext);
