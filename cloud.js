/* ===== drennydrop — облачная синхронизация (Firebase Firestore) =====
   Активируется, только если в firebase-config.js вставлен реальный конфиг.
   Пока конфига нет (или нет сети) — сайт полностью работает на localStorage.
   Модель данных:
     users/{uid}  — инвентарь анонимного игрока (uid из анонимной авторизации)
     stats/global — глобальные счётчики всех спинов (атомарные инкременты;
                    правила Firestore допускают только записи вида «ровно +1 спин»,
                    так что подделать статистику скриптом нельзя) */

const Cloud = (() => {
  let db = null, uid = null, ready = false;
  let pushTimer = null;
  const listeners = { synced: [] };

  function isEnabled(){
    return typeof FIREBASE_ENABLED !== "undefined" && FIREBASE_ENABLED && typeof firebase !== "undefined";
  }

  async function init(){
    if(!isEnabled()) return;
    try{
      firebase.initializeApp(FIREBASE_CONFIG);
      const cred = await firebase.auth().signInAnonymously();
      uid = cred.user.uid;
      db = firebase.firestore();
      await pull();
      ready = true;
      listeners.synced.forEach(f=>{ try{ f(); }catch(e){} });
    }catch(e){
      console.warn("[cloud] работаем локально:", (e && e.message) || e);
      db = null; uid = null;
    }
  }

  /* при загрузке: облако главнее — подтягиваем инвентарь, иначе выгружаем локальный */
  async function pull(){
    const snap = await db.collection("users").doc(uid).get();
    if(snap.exists && Array.isArray((snap.data()||{}).inv)){
      DB.inv = snap.data().inv || [];
      try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }catch(e){}
    } else {
      await pushNow();
    }
  }

  function queuePush(){
    if(!ready) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(()=>{ pushNow().catch(()=>{}); }, 1200);
  }

  async function pushNow(){
    if(!ready) return;
    await db.collection("users").doc(uid).set(
      { inv: DB.inv, lastSeen: Date.now() },
      { merge: true }
    );
  }

  /* дельта статистики спина: атомарные инкременты в глобальный документ + пуш инвентаря */
  async function bumpStats(delta){
    try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }catch(e){}
    queuePush();
    if(!ready) return;
    try{
      const batch = db.batch();
      batch.set(db.collection("stats").doc("global"), {
        total:  firebase.firestore.FieldValue.increment(delta.total  || 0),
        wins:   firebase.firestore.FieldValue.increment(delta.wins   || 0),
        losses: firebase.firestore.FieldValue.increment(delta.losses || 0),
        won:    firebase.firestore.FieldValue.increment(delta.won    || 0),
        lost:   firebase.firestore.FieldValue.increment(delta.lost   || 0)
      }, { merge: true });
      batch.set(db.collection("users").doc(uid),
        { inv: DB.inv, lastSeen: Date.now() },
        { merge: true });
      await batch.commit();
    }catch(e){
      console.warn("[cloud] статистика не ушла в облако:", (e && e.message) || e);
    }
  }

  /* живая подписка админки на глобальную статистику */
  function watchGlobal(cb){
    if(!ready) return;
    try{
      db.collection("stats").doc("global").onSnapshot(s=>{
        cb(s.exists ? s.data() : { total:0, wins:0, losses:0, won:0, lost:0 });
      }, ()=>{ /* ошибки соединения молча игнорируем — показан локальный фолбэк */ });
    }catch(e){}
  }

  async function playerCount(){
    if(!ready) return null;
    try{
      const snap = await db.collection("users").get();
      return snap.size;
    }catch(e){ return null; }
  }

  return {
    init, bumpStats, watchGlobal, playerCount, queuePush,
    get ready(){ return ready; },
    get uid(){ return uid; },
    get enabled(){ return isEnabled(); }
  };
})();
