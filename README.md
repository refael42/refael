# Restaurant Tycoon

An isometric idle restaurant tycoon (landscape): you are the manager of a small Tel Aviv
restaurant that grows into an empire. Expo (React Native) + Skia; runs on Android, iOS and web.

## איך מריצים (Windows)

1. התקנה (פעם אחת): `npm install`
2. בטלפון: מתקינים את האפליקציה **Expo Go** מהחנות.
3. מריצים: `npm start` — יופיע ברקוד (QR). סורקים אותו עם Expo Go (באנדרואיד: מתוך האפליקציה; באייפון: עם המצלמה).
4. בדפדפן: `npm run web` ונפתח `http://localhost:8081`.
5. בדיקות: `npm run check` (בדיקת טיפוסים + בדיקות יחידה).

אחרי התקנת חבילות חדשות — לעצור את השרת (Ctrl+C) ולהפעיל מחדש, אחרת Metro "שוכח" קבצים.

## איך משחקים

- **גוררים** עם האצבע כדי לזוז במפה, **צובטים** (או כפתורי + / −) כדי לעשות זום.
- לקוח בתור עם בועת כיסא → **לוחצים עליו** כדי להושיב.
- מנה מוכנה על הדלפק (קופצת ומנצנצת) → **לוחצים עליה** כדי להגיש.
- שולחן מלוכלך עם ספוג → **לוחצים** כדי לנקות (לחיצות נוספות = מהר יותר).
- יש צוות: **טבח** מבשל, **מלצר** מביא מנות ומפנה שולחנות, **שוטף כלים** שוטף צלחות.
  אפשר תמיד לעזור להם: ללחוץ על מנה מוכנה, על שולחן מלוכלך, או על הכיור (שטיפה מהירה).
- נגמרו הצלחות הנקיות → הטבח נעצר ומופיעה בועה של צלחת עם איקס מעל ערימת הצלחות.

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
