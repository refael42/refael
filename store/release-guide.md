# מדריך העלאה לחנויות — צעד אחרי צעד

המדריך כתוב למי שמעלה אפליקציה בפעם הראשונה. **כל מה שבתיבות האפורות מקלידים במחשב** (בחלון
הפקודות, בתיקיית הפרויקט). איפה שכתוב "לוחצים" — זה באתר.

> ⚠️ את השלבים עם חשבונות ותשלום רק אתה יכול לעשות: אני לא פותח חשבונות ולא מכניס פרטים אמיתיים.

## שלב 0 — החלטות (לפני הכול)
1. **שם האפליקציה.** לבדוק שהוא פנוי: מחפשים אותו ב-App Store וב-Google Play. רעיונות בסוף המדריך.
2. **מזהה האפליקציה** (bundle id). היום: `com.refael.restauranttycoon`. **אחרי ההעלאה הראשונה אי אפשר לשנות אותו.**
3. **אייפד:** כן או לא. היום: כן (`supportsTablet: true` ב-`app.json`).
4. **מייל לתמיכה** — חייב להופיע בחנויות ובמדיניות הפרטיות.

אחרי שמחליטים, אני מעדכן את `app.json`, את הטקסטים ואת מדיניות הפרטיות.

## שלב 1 — חשבונות מפתח (פעם אחת)
1. **Apple:** נכנסים ל-developer.apple.com ← Account ← נרשמים ל-Apple Developer Program (99$ לשנה). צריך Apple ID עם אימות דו-שלבי. האישור לוקח בין שעה לכמה ימים.
2. **Google:** נכנסים ל-play.google.com/console ← נרשמים (25$ פעם אחת). חשבון אישי חדש צריך **בדיקה סגורה של 14 יום עם לפחות 12 בודקים** לפני שמותר לפרסם לכולם.
3. **Expo:** נכנסים ל-expo.dev ← Sign up (חינם). זה השירות שבונה את האפליקציה בענן.

## שלב 2 — חיבור הפרויקט ל-Expo (פעם אחת)
```
npm install -g eas-cli
eas login
eas init
```
`eas init` שואל אם ליצור פרויקט — עונים Yes. הוא מוסיף מזהה פרויקט ל-`app.json`.

## שלב 3 — בנייה ראשונה לבדיקה על הטלפון
- **אנדרואיד (הכי מהיר):**
  ```
  eas build --profile preview --platform android
  ```
  בסוף מקבלים קישור לקובץ APK. פותחים אותו בטלפון ומתקינים.
- **אייפון:** צריך קודם את חשבון Apple. אחר כך:
  ```
  eas build --profile development --platform ios
  ```
  EAS ידריך לרשום את האייפון (סורקים קוד QR).

כאן בודקים: שהמשחק עולה, שהשמירה עובדת אחרי סגירה ופתיחה, ושהקנייה **לא** עובדת עדיין (אין מוצרים בחנות) ומציגה הודעה מסודרת.

## שלב 4 — מדיניות הפרטיות באינטרנט
החנויות דורשות **קישור** למדיניות. הדרך הפשוטה והחינמית: GitHub Pages.
1. ב-GitHub ← המאגר `refael` ← Settings ← Pages.
2. Source: `Deploy from a branch`, Branch: `main` (או הענף שבו יושב הקובץ), Folder: `/ (root)` ← Save.
3. הקישור יהיה בערך: `https://refael42.github.io/refael/store/privacy-policy.html`.

(זה מפרסם את הקובץ לכולם — לכן זה שלב שלך.)

## שלב 5 — יצירת האפליקציה בחנויות
- **App Store Connect** (appstoreconnect.apple.com) ← My Apps ← ➕ ← New App: פלטפורמה iOS, שם, שפה ראשית (עברית או אנגלית), Bundle ID (בוחרים את המזהה מהשלב הראשון), SKU (כל מילה, למשל `restaurant1`).
- **Google Play Console** ← Create app: שם, שפה, Game, Free.

## שלב 6 — מוצרי היהלומים
לפי `store/products.md` — ארבעה מוצרים, **המזהים בדיוק כמו בטבלה**.

## שלב 7 — עמוד החנות
- טקסטים: מעתיקים מ-`store/listing-he.md` ו-`store/listing-en.md`.
- צילומי מסך: מהתיקייה `store/screenshots/` (כל תיקייה = גודל שהחנות מבקשת).
- אייקון: Apple לוקחת אותו מהאפליקציה עצמה; ל-Google מעלים את `store/screenshots/google/icon-512.png`.
- תמונת נושא ל-Google: `store/screenshots/google/feature-1024x500.png`.
- שאלונים (פרטיות, גיל, בטיחות נתונים): התשובות ב-`store/questionnaires.md`.

## שלב 8 — בנייה לחנות ושליחה
```
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```
גרסת `production` היא הגרסה לחנויות: בלי כלי הבדיקה (כסף לבדיקה, אוטובוס לבדיקה, מד מהירות) ובלי כפתור הפרסומת לדוגמה.

## שלב 9 — בדיקת קנייה אמיתית (לפני שמפרסמים)
- **Apple:** App Store Connect ← Users and Access ← Sandbox ← יוצרים "בודק" (מייל בדיקה). בטלפון: הגדרות ← App Store ← Sandbox Account. קונים במשחק — לא יורד כסף אמיתי.
- **Google:** Play Console ← Setup ← License testing ← מוסיפים את המייל שלך. מעלים לגרסת Internal testing וקונים — לא יורד כסף.

בודקים: היהלומים מתווספים פעם אחת בלבד, וקנייה שבוטלה לא מוסיפה כלום.

## שלב 10 — שליחה לבדיקה
- Apple: בעמוד הגרסה ← Add for Review ← Submit. בדרך כלל 1–3 ימים.
- Google: Production ← Create release ← Review. (בחשבון אישי חדש — אחרי 14 יום של בדיקה סגורה.)

---

## רעיונות לשם (לבדוק שהם פנויים)
- **שף טייקון** / Chef Tycoon
- **אימפריית הטעם** / Taste Empire
- **מסעדה מטורפת** / Crazy Kitchen Tycoon
- **הכתר של השף** / Chef's Crown
- **ביסטרו בום** / Bistro Boom
