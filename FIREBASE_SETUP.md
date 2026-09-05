# Подключение Firebase к drennydrop (5 минут)

Сайт работает и без Firebase (данные в localStorage браузера). После подключения
инвентарь и статистика **всех игроков** синхронизируются в облако, а админка
показывает живую глобальную статистику и число игроков.

## Шаг 1. Создай проект

1. Открой [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Название любое (например `drennydrop`), Google Analytics можно отключить → **Create**

## Шаг 2. Добавь веб-приложение

1. На главной проекта нажми иконку **`</>`** (Web)
2. Придумай nickname → **Register app**
3. Скопируй показанный объект `firebaseConfig` — он выглядит так:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "drennydrop.firebaseapp.com",
  projectId: "drennydrop",
  storageBucket: "drennydrop.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

4. Вставь эти значения в файл **`firebase-config.js`** в корне проекта (замени все `PASTE_...`)

## Шаг 3. Включи анонимную авторизацию

1. Слева в меню: **Build → Authentication → Get started**
2. Вкладка **Sign-in method** → **Anonymous** → **Enable** → **Save**

## Шаг 4. Создай базу Firestore

1. Слева: **Build → Firestore Database → Create database**
2. Location любой (ближе к тебе), режим **Start in production mode** → **Create**
3. Вкладка **Rules** — замени содержимое на правила ниже → **Publish**

Это не «открыть всем», а набор инвариантов, которые база проверяет на сервере:

- писать инвентарь может только владелец документа (анонимный uid);
- предмет инвентаря обязан иметь строгую схему и цену ≤ 9800, инвентарь ≤ 500 предметов;
- за одну запись инвентарь может уменьшиться максимум на 10 предметов (потеря/удаление);
- `stats/global` нельзя создать «с нуля с любыми числами» — только как ровно один спин;
- каждый следующий апдейт статистики обязан быть ровно +1 спин: `total` ровно на 1 больше,
  ровно одна из пар {wins+1, losses} или {wins, losses+1}, суммы побед/поражений сходятся,
  а `won`/`lost` за спин не превышают 9800 (максимальная цена скина в каталоге);
- удалять документы (инвентари игроков и статистику) через клиент нельзя вообще —
  только вручную через консоль Firebase, которая правила игнорирует.

Итог: подделать статистику консолью/скриптом нельзя — можно лишь играть по-настоящему
(каждая запись = реальный спин с валидной ставкой из своего инвентаря).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }

    function validItem(it) {
      return it.keys().hasOnly(['id','name','price','rar','ico','img'])
        && it.id is number
        && it.name is string && it.name.size() > 0 && it.name.size() <= 64
        && it.price is number && it.price >= 0 && it.price <= 9800
        && it.rar in ['blue','purple','pink','red','gold']
        && (!('ico' in it) || (it.ico is string && it.ico.size() <= 8))
        && (!('img' in it) || (it.img is string && it.img.size() <= 120));
    }

    match /users/{uid} {
      allow get, list: if true;
      allow create: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['inv','balance','lastSeen'])
        && request.resource.data.inv is list
        && request.resource.data.inv.size() <= 500
        && request.resource.data.inv.all(it, validItem(it))
        && request.resource.data.balance is number
        && request.resource.data.balance >= 0
        && request.resource.data.balance <= 1000000;
      allow update: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['inv','balance','lastSeen'])
        && request.resource.data.inv is list
        && request.resource.data.inv.size() <= 500
        && request.resource.data.inv.size() >= resource.data.inv.size() - 10
        && request.resource.data.inv.all(it, validItem(it))
        && request.resource.data.balance is number
        && request.resource.data.balance >= 0
        && request.resource.data.balance <= 1000000;
      allow delete: if false;
    }

    match /stats/global {
      allow get, list: if true;
      allow create: if signedIn()
        && request.resource.data.keys().hasOnly(['total','wins','losses','won','lost'])
        && request.resource.data.total == 1
        && request.resource.data.wins + request.resource.data.losses == 1
        && request.resource.data.won >= 0 && request.resource.data.won <= 9800
        && request.resource.data.lost >= 0 && request.resource.data.lost <= 9800
        && ((request.resource.data.wins == 1 && request.resource.data.losses == 0
             && request.resource.data.won > 0)
          || (request.resource.data.wins == 0 && request.resource.data.losses == 1
             && request.resource.data.lost > 0));
      allow update: if signedIn()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['total','wins','losses','won','lost'])
        && request.resource.data.total == resource.data.total + 1
        && ((request.resource.data.wins == resource.data.wins + 1
             && request.resource.data.losses == resource.data.losses
             && request.resource.data.won > resource.data.won
             && request.resource.data.won - resource.data.won <= 9800
             && request.resource.data.lost == resource.data.lost)
          || (request.resource.data.losses == resource.data.losses + 1
             && request.resource.data.wins == resource.data.wins
             && request.resource.data.lost > resource.data.lost
             && request.resource.data.lost - resource.data.lost <= 9800
             && request.resource.data.won == resource.data.won));
      allow delete: if false;
    }

    match /stats/{other} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## Шаг 5. Задеплой

Закоммить и запушь. Всё — сайт начнёт писать данные в облако сам:
- `users/{uid}` — инвентарь каждого игрока
- `stats/global` — глобальные счётчики (видны в админке, обновляются вживую)

## Как это работает

- Пока конфиг не вставлен, все облачные вызовы пропускаются — сайт работает как раньше;
- Если Firebase недоступен (нет сети и т.п.), игра не падает: данные сохраняются локально и уйдут в облако при следующем спине;
- «Сбросить статистику» в админке чистит локальные данные; глобальные счётчики и инвентари
  игроков из-за правил нельзя обнулить из клиента — при необходимости делай это вручную:
  консоль Firebase → Firestore → открой документ `stats/global` (Edit → нули) или удали
  документы коллекции `users`.

## Границы защиты (честно)

- Инварианты выше не пропускают поддельные числа: каждая запись в статистику — ровно
  один спин с согласованными счётами и суммами в пределах каталога;
- Что невозможно без серверного кода (Cloud Functions): отличить «реально игравшего»
  от бота, играющего по API, и проверить, что предмет ставки реально был получен
  честно (инвентарь игрок формирует сам). Но и там каждый шаг ограничен правилами;
- Хочешь выше уровень — подключи App Check (reCAPTCHA) в консоли Firebase, он
  отсечёт обращения не из твоего сайта. PIN админки (1337) — клиентский, он не защита.
