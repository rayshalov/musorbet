/* ===== drennydrop — конфиг Firebase =====
   Как подключить (5 минут) — см. FIREBASE_SETUP.md в корне проекта.
   Пока сюда не вставлен реальный ключ, сайт работает на localStorage. */

const FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* true только когда конфиг вставлен */
const FIREBASE_ENABLED = !!FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith("PASTE");
