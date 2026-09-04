/* ===== FRAGDROP — звуки (Web Audio API, без аудиофайлов) ===== */
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
    /* трещотка колеса; speed 0..1 — темп задаёт анимация.
       Три тембра на выбор, все — чистые короткие тоны без шума (шум и давал «грязь»). */
    tick(speed=1){
      const s = 0.03 + 0.025*speed;   // громкость щелчка растёт на быстрой фазе
      if(tickStyle === "wood"){
        tone({freq:1180, type:"sine", dur:0.035, peak:s, slide:880, lp:2200});
      } else if(tickStyle === "soft"){
        tone({freq:820, type:"sine", dur:0.05, peak:s*0.7, slide:660, lp:1300});
      } else {                        // mech: сухой клик храповика
        tone({freq:1950, type:"sine", dur:0.02, peak:s, slide:1500, lp:6000});
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
  const b = document.querySelector("#sound-toggle");
  if(b) b.textContent = on ? "🔊" : "🔇";
}

/* перебор тембров трещотки (кнопка в шапке) */
function cycleTickSound(){
  const name = Sound.cycleTickStyle();
  if(window.toast) toast("Трещотка: " + name, "ok");
}
