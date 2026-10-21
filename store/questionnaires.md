# תשובות לשאלונים של החנויות

התשובות מבוססות על מה שהמשחק עושה היום: אין רשת (חוץ מהקנייה עצמה דרך החנות), אין פרסומות,
אין כלי ניתוח, הכול נשמר במכשיר. **אם מוסיפים פרסומות או כלי ניתוח — חייבים לעדכן את כל התשובות כאן.**

## App Store Connect

### App Privacy (פרטיות)
- **Data Collection:** `No, we do not collect data from this app`.
  (קניות דרך Apple לא נחשבות "איסוף" של המפתח.)
- **Privacy Policy URL:** כתובת שבה יושב `privacy-policy.html` (ראו מדריך ההעלאה, שלב 4).

### Age Rating (דירוג גיל)
השאלון של Apple התחלף ב-2025 (דרגות ‎4+‎, ‎9+‎, ‎13+‎, ‎16+‎, ‎18+‎). התשובות המעודכנות, שאלה אחרי
שאלה, נמצאות ב-`apple-review.md` סעיף 6. בקצרה:

- **Alcohol...: None.** מאוקטובר 2026 הבר מגיש רק משקאות בלי אלכוהול (שייקים, מוקטיילים, סודה).
- **Loot boxes: Yes.** סיבוב בגלגל ביהלומים, והסיכויים מוצגים לפני הסיבוב.
- **Simulated gambling: None.** זה גלגל פרסים ולא קזינו.
- **Profanity or crude humor: Infrequent.** כמה ביקורות מצחיקות על שירותים.
- כל השאר: None / No.

הדירוג הצפוי: **‎9+‎** (ובאוסטרליה ‎16+‎ אוטומטית בגלל ה-loot boxes).

### Export Compliance (הצפנה)
כבר מוגדר ב-`app.json` (`ITSAppUsesNonExemptEncryption: false`): לא צריך למלא כלום.

### קטגוריה
- ראשית: **Games** ← **Simulation**
- משנית: **Games** ← **Casual**

## Google Play Console

### Data safety (בטיחות נתונים)
- Does your app collect or share any of the required user data types? **No**
- Is all of the user data collected by your app encrypted in transit? (לא רלוונטי: אין איסוף) — **No data collected**
- Do you provide a way for users to request that their data is deleted? — אין נתונים בשרת; המחיקה במכשיר.

### Ads
- Does your app contain ads? **No**

### Content rating (IARC)
- קטגוריה: **Game**
- Violence: No · Sexuality: No · Language: No · Controlled substances: **No** (הבר מגיש רק משקאות בלי אלכוהול)
- Gambling: **No real or simulated gambling.** Randomized items bought with in-game currency: **Yes** (סיבוב בגלגל ביהלומים, הסיכויים מוצגים)
- Purchases: **Yes, in-app purchases** · Random items for purchase (loot boxes): **Yes**
- User interaction / chat / sharing location: **No**

### Target audience and content
- גיל יעד: **13 ומעלה** (בגילאים צעירים יותר נכנסים לכללי "Families" המחמירים).
- Appeals to children? **No** (המשחק לא מכוון לילדים במיוחד).

### App category
- **Game** ← **Simulation**

### App access
- All functionality is available without special access: **Yes** (אין התחברות).

### Government apps / Financial features / Health
- **No** לכולם.
