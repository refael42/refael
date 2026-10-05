# Restaurant Tycoon

An isometric idle restaurant tycoon (landscape): you are the manager of a small Tel Aviv
restaurant that grows into an empire. Expo (React Native) + Skia; runs on Android, iOS and web.

## איך מריצים (Windows)

**פעם אחת בלבד:**
1. מתקינים **Node.js** מ-https://nodejs.org (הכפתור הירוק **LTS**, ואז Next עד הסוף).
2. בטלפון: מתקינים **Expo Go** מחנות האפליקציות.
3. מורידים את המשחק: בעמוד https://github.com/refael42/refael/tree/claude/restaurant-tycoon-game-aye10l
   לוחצים על הכפתור הירוק **Code** ← **Download ZIP**, ואז קליק ימני על הקובץ ← **Extract All** (חילוץ).

**בכל פעם שרוצים לשחק:**
1. נכנסים לתיקייה שחולצה ולוחצים פעמיים על **start-windows.bat**.
   (אם Windows מזהיר — "More info" ← "Run anyway".)
2. נפתח חלון שחור, ואחרי כמה דקות (בפעם הראשונה) מופיע ברקוד (QR).
3. בטלפון: Expo Go ← **Scan QR code** ← סורקים. הטלפון והמחשב צריכים להיות על **אותה רשת Wi-Fi**.
4. או בדפדפן במחשב: לוחצים על המקש **w** בחלון השחור.

לגרסה חדשה: מורידים שוב את ה-ZIP (או `git pull`) ומריצים שוב את start-windows.bat.

**למפתחים:** `npm run check` (בדיקות), `npm run balance` (דוח קצב התקדמות), `npm run web` (דפדפן).

אחרי התקנת חבילות חדשות — לעצור את השרת (Ctrl+C) ולהפעיל מחדש, אחרת Metro "שוכח" קבצים.

## איך משחקים

- **גוררים** עם האצבע כדי לזוז במפה, **צובטים** עם שתי אצבעות כדי לעשות זום (בדפדפן: גלגלת העכבר).
- לקוח בתור עם בועת כיסא → **לוחצים עליו** כדי להושיב.
- מנה מוכנה על הדלפק (קופצת ומנצנצת) → **לוחצים עליה** כדי להגיש.
- שולחן מלוכלך עם ספוג → **לוחצים** כדי לנקות (לחיצות נוספות = מהר יותר).
- יש צוות: **טבח** מבשל, **מלצר** מביא מנות ומפנה שולחנות, **שוטף כלים** שוטף צלחות.
  אפשר תמיד לעזור להם: ללחוץ על מנה מוכנה, על שולחן מלוכלך, או על הכיור (שטיפה מהירה).
- נגמרו הצלחות הנקיות → הטבח נעצר ומופיעה בועה של צלחת עם איקס מעל ערימת הצלחות.
- **שדרוגים:** חץ ירוק מעל משהו = אפשר לשדרג אותו. לוחצים על הכיריים / הכיור / שולחן / דלפק
  ההגשה וכו׳ → נפתח חלון השדרוג שלו (והוא מקבל מסגרת זוהרת). הכפתור הירוק "שדרוגים" למטה
  פותח את כל השדרוגים לפי קטגוריות.
- **שולחן חדש:** המקום המקווקו על השטיח עם "+" — לוחצים עליו וקונים שולחן נוסף.
- ברמות 10, 25, 50 הדברים משנים מראה (כיור כפול, מדיח, כיריים אדומות...). מרמה 75 — זוהר זהב.
- **גלגל השיניים** (למטה בצד): שפה, מונה FPS, גלריית דמויות, בדיקת עומס, איפוס התקדמות.
- המשחק נשמר לבד. כשחוזרים אחרי יותר מדקה — מסך "ברוכים השבים" עם הכסף שהצוות הרוויח.

## Project layout

| Folder | What lives there |
|--------|------------------|
| `src/sim` | Pure, deterministic simulation: customers, kitchen, A*, commands (no UI imports) |
| `src/data` | Data tables: map, dishes, customer types, economy, looks |
| `src/render` | Skia renderer: procedural low-poly art → atlas, isometric drawing, FX, HUD, camera |
| `src/ui` | React Native screen, buttons, overlays |
| `src/store` | Zustand stores |
| `src/i18n` | Hebrew + English strings |
| `tests` | Vitest unit tests |

See `PROGRESS.md` for milestones, decisions and known issues.
