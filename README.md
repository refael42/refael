# Restaurant Tycoon

A cozy mobile restaurant tycoon: you are the manager of a tiny Tel Aviv street-food stand that
grows into a restaurant empire. Expo (React Native) + Skia, runs on Android, iOS and the web.

## איך מריצים (Windows)

1. התקנה (פעם אחת): `npm install`
2. בטלפון: מתקינים את האפליקציה **Expo Go** מהחנות.
3. מריצים: `npm start` — יופיע ברקוד (QR). סורקים אותו עם Expo Go (באנדרואיד: מתוך האפליקציה; באייפון: עם המצלמה).
4. בדפדפן: `npm run web` ונפתח `http://localhost:8081`.
5. בדיקות: `npm run check` (בדיקת טיפוסים + בדיקות יחידה).

אחרי התקנת חבילות חדשות — לעצור את השרת (Ctrl+C) ולהפעיל מחדש, אחרת Metro "שוכח" קבצים.

## Project layout

| Folder | What lives there |
|--------|------------------|
| `src/sim` | Pure, deterministic game simulation (no UI imports; runs headless in tests) |
| `src/data` | Data tables: looks, scenes, timing and (later) balance/upgrade tables |
| `src/render` | Skia renderer: procedural art → atlas, UI-thread frame drawing |
| `src/ui` | React Native screens, buttons, overlays |
| `src/store` | Zustand stores |
| `src/i18n` | Hebrew + English strings |
| `tests` | Vitest unit tests |

See `PROGRESS.md` for milestones, decisions and known issues.
