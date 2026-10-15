# תשובות לשאלונים של החנויות

התשובות מבוססות על מה שהמשחק עושה היום: אין רשת (חוץ מהקנייה עצמה דרך החנות), אין פרסומות,
אין כלי ניתוח, הכול נשמר במכשיר. **אם מוסיפים פרסומות או כלי ניתוח — חייבים לעדכן את כל התשובות כאן.**

## App Store Connect

### App Privacy (פרטיות)
- **Data Collection:** `No, we do not collect data from this app`.
  (קניות דרך Apple לא נחשבות "איסוף" של המפתח.)
- **Privacy Policy URL:** כתובת שבה יושב `privacy-policy.html` (ראו מדריך ההעלאה, שלב 4).

### Age Rating (דירוג גיל)
| שאלה | תשובה |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content / Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use or References | **Infrequent/Mild** (יש בר עם בירה, קוקטיילים ושמפניה) |
| Simulated Gambling | **Infrequent/Mild** (גלגל מזל עם פרסים וירטואליים; אפשר לקנות סיבוב ביהלומים) |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Mature/Suggestive Themes | None |
| Contests | None |
| Unrestricted Web Access | No |
| אם נשאלים על פריטים אקראיים בתשלום (loot boxes) | **Yes** (סיבוב בגלגל ביהלומים; הסיכויים מוצגים במסך הגלגל) |

הדירוג הצפוי: **13+** (בגלל ההימורים המדומים והאלכוהול). השאלון של Apple משתנה מדי פעם: אם יש שאלה שלא מופיעה כאן, עונים לפי מה שהמשחק עושה (ראו למעלה) או שולחים לי אותה.

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
- Violence: No · Sexuality: No · Language: No · Controlled substances: **Yes — references to alcohol (a bar serving drinks)**
- Gambling: **Simulated gambling — yes** (גלגל מזל עם פרסים וירטואליים, בלי כסף אמיתי שאפשר להרוויח)
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
