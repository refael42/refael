# מה Apple דורשים כדי לאשר את שף טייקון (מחקר אוקטובר 2026)

המסמך הזה מרכז את כל הדרישות של App Review שנוגעות למשחק: מה כבר מוכן בקוד, מה תיקנתי בעקבות
המחקר, ומה רק אתה יכול לעשות ב-App Store Connect. בסוף יש טקסט מוכן ל-Review Notes ורשימת מקורות.

> **שורה תחתונה:** המשחק עומד בכל הדרישות שאפשר לממש בקוד. נשארו רק פעולות בחשבון שלך: חוזה
> אפליקציות בתשלום, פרטי בנק ומס, סטטוס סוחר באיחוד האירופי, מילוי השאלונים, העלאת מוצרים וצילומי מסך.

---

## 1. השינויים האחרונים אצל Apple (2025–2026) שחשוב להכיר

| תאריך | מה השתנה | מה זה אומר לנו |
|---|---|---|
| 24.7.2025 | דירוג גילאים חדש: ‎4+‎, ‎9+‎, ‎13+‎, ‎16+‎, ‎18+‎ ושאלון חדש (בקרות, יכולות, נושאים רפואיים, אלימות, הימורים ו-loot boxes) | צריך לענות על השאלון החדש (סעיף 6). המשחק מכוון ל-‎9+‎ |
| 31.1.2026 | בלי תשובות לשאלון החדש אי אפשר להגיש גרסאות | עונים בהגשה הראשונה |
| 28.4.2026 | כל העלאה חייבת להיבנות עם Xcode 26 ו-iOS 26 SDK | ה-build ב-EAS עם ‎`"image": "latest"`‎ (סעיף 3) |
| 8.6.2026 | עדכון הנחיות: בטיחות ילדים ובני נוער, סעיף 4.3 (ספאם/העתקות) | המשחק מקורי, אין צ'אט ואין תוכן משתמשים |
| 9.2026 | שאלות על רשתות חברתיות בשאלון הגילאים | התשובה: אין רשת חברתית |
| 16.10.2026 | **סעיף 2.5.19 החדש:** אסור לשים באפליקציה פונקציות נסתרות, רדומות או לא מתועדות, ואסור להסתיר אותן בקוד (כולל code obfuscation). העונש: הסרה מהחנות וסגירת חשבון המפתח | זה הסרטון ששלחת על obfuscation. ראה סעיף 4 |

---

## 2. טבלת הדרישות: מה מצבנו

| סעיף | הדרישה | אצלנו | סטטוס |
|---|---|---|---|
| 2.1 | אפליקציה גמורה, בלי קריסות, בלי תוכן זמני, כל הרכישות עובדות ונגישות לבודק | המשחק שלם. 530 בדיקות אוטומטיות עוברות | ✅ |
| 2.1(b) | כל מוצר שהוגדר בחנות חייב להופיע במשחק ולעבוד | 7 מוצרים: 4 חבילות יהלומים ו-3 חבילות מבצע, כולם בחנות במשחק | ✅ (צריך להעלות אותם, סעיף 5) |
| 2.3.2 | בתיאור ובצילומים צריך לציין שיש רכישות בתוך האפליקציה | בתיאור: "המשחק חינמי... אפשר לקנות יהלומים" | ✅ |
| 2.3.7 | בלי מחירים ובלי מילים לא קשורות בשם, בכותרת המשנה ובצילומים | ✅ | ✅ |
| 2.3.8 | צילומים ואייקונים מתאימים לגיל ‎4+‎ | ✅ | ✅ |
| 2.3.10 | אסור להזכיר פלטפורמות אחרות (Google Play / Android) באפליקציה ובתיאור | **תוקן:** במסך הפרטיות כתוב "Google Play" רק באנדרואיד, ובאייפון רק "App Store" | ✅ תוקן |
| 2.5.19 | בלי פונקציות נסתרות או לא מתועדות, בלי obfuscation | כלי הבדיקה (כסף לבדיקה, אוטובוס, גלריה, בדיקת עומס, מונה FPS) קיימים **רק** בגרסאות בדיקה. בגרסת החנות (‎`EXPO_PUBLIC_STORE=1`‎) הם לא מופיעים. **תוקן:** גם מונה ה-FPS הוסתר בגרסת החנות | ✅ תוקן |
| 3.1.1 | כל דבר דיגיטלי שנמכר בכסף אמיתי דרך In-App Purchase | כל הקניות דרך StoreKit (expo-iap) | ✅ |
| 3.1.1 | מטבע שנקנה לא פג | היהלומים לא פגים לעולם | ✅ |
| 3.1.1 | **מנגנון שחזור לרכישות שאפשר לשחזר** | **נוסף:** כפתור "שחזור רכישות" בהגדרות ובחנות. הוא מחזיר את הגיבורים מחבילות שנקנו (הם מתנה "לתמיד") ולא מחזיר יהלומים, כי יהלומים מתכלים. נוסף גם המפתח ‎`SKIncludeConsumableInAppPurchaseHistory`‎ כדי ש-iOS 18 ומעלה יחזיר גם קניות ישנות | ✅ נוסף |
| 3.1.1 | **loot boxes:** אם קונים משהו אקראי צריך להציג את הסיכויים **לפני** הקנייה | בגלגל המזל אפשר לסובב ביהלומים. **תוקן:** כשהסיבוב הבא עולה יהלומים, טבלת הסיכויים פתוחה מעצמה, עם אחוז לכל פרס | ✅ תוקן |
| 4.2 / 4.3 | תוכן מספיק ומקוריות | 8 בניינים, מאות שדרוגים, צוות, בר, משלוחים, מבקר סמוי, גלגל מזל. אומנות, מוזיקה וטקסטים מקוריים | ✅ |
| 4.5.4 | התראות לא חובה. התראות **שיווקיות** רק בהסכמה מפורשת עם נוסח הסכמה, ועם דרך לבטל | **תוקן:** תזכורות המשחק (שדרוג מוכן, סיבוב חינם) רגילות. תזכורות על חבילות בתשלום כבויות כברירת מחדל ונדלקות רק במתג נפרד בהגדרות עם הנוסח "מסכים/ה לקבל תזכורת כשחבילה בתשלום עומדת להיגמר. אפשר לכבות בכל רגע" | ✅ תוקן |
| 5.1.1(i) | קישור למדיניות פרטיות גם ב-App Store Connect וגם בתוך האפליקציה | הגדרות ← מדיניות פרטיות. הקובץ לאתר: ‎`store/privacy-policy.html`‎ | ✅ (צריך URL ציבורי) |
| 5.1.1(i) | המדיניות מסבירה מה נאסף, איך מוחקים ואיך מבטלים הסכמה | לא נאסף כלום. מחיקה: "איפוס כל ההתקדמות" או מחיקת האפליקציה | ✅ |
| 5.1.1(v) | **אם יש יצירת חשבון, חובה מחיקת חשבון בתוך האפליקציה** | **לא רלוונטי: אין חשבונות**. הסרטון ששלחת מדבר על אפליקציות עם הרשמה. לנו יש רק "איפוס כל ההתקדמות" שמוחק הכול | ✅ לא נדרש |
| 4.8 | "Sign in with Apple" חובה **רק** אם יש התחברות דרך צד שלישי (Google, Facebook) | אין התחברות בכלל | ✅ לא נדרש |
| 5.1.2 | אסור לחייב הרשאות (התראות וכו') כדי לשחק | הכול עובד גם בלי התראות | ✅ |
| ATT | חלון "Allow tracking" חובה רק אם עוקבים אחרי המשתמש | אין מעקב, אין פרסומות, אין כלי ניתוח | ✅ לא נדרש |
| Privacy Manifest | קובץ ‎`PrivacyInfo.xcprivacy`‎ שמצהיר על ממשקים רגישים | **נוסף** ב-‎`app.json`‎: לא עוקבים, לא אוספים, ונימוקים לשמירה המקומית, לזמני קבצים, לזמן אתחול ולנפח אחסון | ✅ נוסף |
| Export compliance | הצהרת הצפנה | ‎`ITSAppUsesNonExemptEncryption: false`‎ כבר ב-‎`app.json`‎ | ✅ |
| דירוג גיל | תשובות כנות לשאלון | **תוקן:** כל המשקאות בבר עכשיו בלי אלכוהול. אזכור אלכוהול היה מעלה את המשחק ל-‎13+‎ ואולי ‎18+‎. התשובות בסעיף 6, והתוצאה ‎9+‎ בגלל ה-loot box | ✅ תוקן |
| iPad | גם אפליקציה לאייפון נבדקת על אייפד ("must behave properly on iPad") | ‎`supportsTablet: true`‎. המשחק לרוחב ומתאים את עצמו לגודל המסך. צריך צילומי מסך לאייפד | ⚠️ לבדוק במכשיר |

---

## 3. מה רק אתה יכול לעשות (לפי הסדר)

1. **אישור התוכנית:** ההזמנה ממתינה. לא משלמים שוב (ראה את ההודעה בצ'אט).
2. **Agreements, Tax, and Banking** (ב-App Store Connect): לחתום על **Paid Applications Agreement**, ולהוסיף **חשבון בנק** ו**טופסי מס** (W-8BEN לתושב ישראל). **בלי זה אי אפשר למכור מוצרים בתוך האפליקציה, והבודק יראה חנות ריקה וידחה (סעיף 2.1)**.
3. **סטטוס סוחר באיחוד האירופי (DSA):** App Information ← App Store Regulations and Permits ← Digital Services Act. מי שמרוויח מהמשחק הוא "Trader", ואז הכתובת, הטלפון והמייל שלך מוצגים בעמוד המשחק באיחוד האירופי. אפשר גם לא להפיץ באיחוד האירופי בהתחלה.
4. **קישורים ציבוריים:** להעלות את ‎`store/privacy-policy.html`‎ לאתר (למשל GitHub Pages או Netlify) ולהכניס את ה-URL ב-**Privacy Policy URL**. גם **Support URL** הוא שדה חובה (מספיק עמוד עם מייל ליצירת קשר).
5. **App Privacy:** לבחור **"Data Not Collected"** (אנחנו באמת לא אוספים כלום).
6. **שאלון דירוג גיל:** התשובות בסעיף 6.
7. **מוצרים בתוך האפליקציה:** 7 מוצרים מסוג Consumable, בדיוק לפי ‎`store/products.md`‎. **לכל מוצר חובה צילום מסך לבודק ו-Review Notes**, ו**המוצרים הראשונים חייבים להיות מוגשים יחד עם גרסת האפליקציה** (בעמוד הגרסה ← In-App Purchases ← לסמן את כולם).
8. **צילומי מסך:** אייפון ‎6.9"‎ (‏2868×1320 לרוחב) ואייפד ‎13"‎ (‏2752×2064 לרוחב), כי המשחק תומך באייפד. הם צריכים להראות את המשחק עצמו ולא רק את מסך הפתיחה (2.3.3).
9. **ה-build:** ‏`eas build --platform ios --profile production` (בפרופיל production כבר מוגדר ‎`EXPO_PUBLIC_STORE=1`‎). אם EAS מתלונן על SDK, להוסיף ‎`"image": "latest"`‎ לפרופיל ה-iOS, כדי שהבנייה תיעשה עם Xcode 26.
10. **בדיקה במכשיר אמיתי לפני ההגשה:** קנייה ב-Sandbox, "שחזור רכישות", כיבוי התראות, ומשחק של כמה דקות בלי קריסה.

---

## 4. סעיף 2.5.19 ו-obfuscation (מה שהיה בסרטון)

- **מה הכלל אומר:** כל מה שבאפליקציה צריך להיות גלוי ומובן למשתמש ולבודק. אסור "להחביא" פונקציה שתידלק אחרי האישור, ואסור לערבל את הקוד כדי להסתיר אותה.
- **מה אצלנו:**
  - אין שום פונקציה נסתרת. כל מה שקיים מופיע במסכים ומוסבר במדריך "איך משחקים".
  - הקוד לא מעורבב בכוונה. הכיווץ הרגיל של React Native ו-Hermes הוא בנייה סטנדרטית ולא obfuscation.
  - כלי הבדיקה שלי מוסתרים לגמרי בגרסת החנות.
- **עדכונים מרחוק (EAS Update):** המשחק מוגדר לקבל עדכוני JavaScript בלי לעבור שוב בדיקה. לפי 2.5.19 ו-3.3.1 **משתמשים בזה רק לתיקוני באגים**. פיצ'ר חדש (בניין, חבילה בתשלום, אירוע) עולה רק כגרסה חדשה שעוברת בדיקה ומתוארת ב-Review Notes.

---

## 5. מוצרים בתוך האפליקציה: מה לכתוב ל-Apple

**לכל מוצר:** Type = **Consumable**. הצילום לבודק הוא צילום של החנות במשחק, ומ-Review Notes יש נוסח מוכן למטה.

| Product ID | Review Notes (לכל מוצר) |
|---|---|
| ‎`gems80`, `gems500`, `gems1200`, `gems3000`‎ | Adds the stated number of gems to the player's balance. Gems never expire and are spent in the in-game shop. Open: tap the gem counter (top-left) → Gems tab. |
| ‎`offer_starter`‎ | Starter pack, sold once during the player's first 3 days: 300 gems + the hero "Sunny", a permanent worker. The hero can be restored with "Restore purchases" (Settings, or the bottom of the shop). |
| ‎`offer_hero`‎ | 800 gems + the hero of the current 48-hour turn (a permanent worker). The timer shown in the app is real; heroes rotate every 48 hours. Restorable with "Restore purchases". |
| ‎`offer_mega`‎ | 4000 gems + the hero of the current turn + 12 hours of the restaurant's income at once. Restorable hero as above. |

---

## 6. שאלון דירוג הגיל: התשובות (התוצאה: ‎9+‎)

| חלק | שאלה | תשובה | למה |
|---|---|---|---|
| In-App Controls | Parental controls / Age assurance | No / No | אין |
| Capabilities | Unrestricted web access | No | אין דפדפן |
| | User-generated content | No | השמות שהשחקן כותב נשמרים רק אצלו ואף אחד אחר לא רואה אותם |
| | Messaging and chat / Social media | No / No | |
| | Advertising | No | אין פרסומות |
| Mature Themes | Profanity or crude humor | **Infrequent** | כמה ביקורות מצחיקות על שירותים מלוכלכים. זה ‎9+‎ בכל מקרה, וזהירות לא מזיקה |
| | Horror or fear themes | None | |
| | Alcohol, tobacco, or drug use or references | **None** | הבר מגיש עכשיו רק משקאות בלי אלכוהול |
| Medical or Wellness | Medical / Health | None / No | |
| Sexuality or Nudity | הכול | None | |
| Violence | Cartoon / Realistic / Weapons | None | |
| Chance-Based | Contests | None | הפסטיבל הוא אתגר אישי ולא תחרות בין שחקנים |
| | Simulated gambling / Gambling | None / No | |
| | **Loot boxes** | **Yes** | סיבוב בגלגל המזל ביהלומים נותן פרס אקראי. הסיכויים מוצגים (‎9+‎) |

**שימו לב:** באוסטרליה loot boxes מקבלים ‎16+‎, וזה קורה אוטומטית.

---

## 7. טקסט מוכן ל-"Notes" לבודק (App Review Information)

```
Chef Tycoon is an offline restaurant-management game. No account or sign-in is needed:
open the app and play. All progress is stored on the device only; we collect no data.

In-app purchases (all consumable): 4 gem packs and 3 offer packs (Shop: tap the gem counter
at the top-left; offers: the crown banner in the shop). Gems never expire. The offer packs
include a permanent hero worker; "Restore purchases" (Settings, and at the bottom of the
shop) brings those heroes back on a new device. The timers on the offers are real.

Lucky wheel: one free spin every 4 hours; extra spins cost gems. The odds of every prize are
shown in the wheel panel before any paid spin ("Odds").

Notifications are optional (Settings > Phone reminders). Reminders about paid offers are off
by default and only sent if the player turns on "Offer reminders" in Settings.

The game is in Hebrew and English (Settings > Language).
```

---

## 8. לפני שלוחצים "Submit for Review"

- [ ] נבנה מ-Xcode 26 / iOS 26 SDK (פרופיל production).
- [ ] בגרסה אין "כסף לבדיקה", "אוטובוס" או "מונה FPS" (בדיקה מהירה בהגדרות).
- [ ] קנייה ב-Sandbox מוסיפה יהלומים, ו"שחזור רכישות" עובד ומחזיר הודעה.
- [ ] כל 7 המוצרים במצב "Ready to Submit" ומסומנים בגרסה.
- [ ] Privacy Policy URL ו-Support URL נפתחים.
- [ ] App Privacy מוגדר כ-Data Not Collected. שאלון הגיל מולא לפי סעיף 6.
- [ ] צילומי מסך לאייפון ‎6.9"‎ ולאייפד ‎13"‎ מהמשחק עצמו.
- [ ] משחק של 10 דקות על אייפון ועל אייפד בלי קריסה.
- [ ] Paid Applications Agreement, בנק ומס: Active.
- [ ] DSA: סטטוס סוחר נבחר.

---

## מקורות

- [App Review Guidelines (Apple)](https://developer.apple.com/app-store/review/guidelines/): סעיפים 2.1, 2.3, 2.5.19, 3.1.1, 4.5.4, 5.1.1, 5.1.2.
- [Age ratings values and definitions (Apple)](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions): הטבלה של loot boxes ‎9+‎ ואלכוהול ‎13+‎/‎18+‎.
- [Updated age ratings in App Store Connect (Apple)](https://developer.apple.com/news/?id=ks775ehf)
- [Apple Adds Section 2.5.19 Banning Hidden App Features (AI Weekly, 17.10.2026)](https://aiweekly.co/alerts/apple-adds-section-2519-banning-hidden-app-features)
- [What App Review Looks For, October 2026](https://blakecrosley.com/blog/app-review-what-reviewers-look-for-2026): בדיקה על אייפד, IAP, 22,000 דחיות על פונקציות נסתרות ב-2025.
- [Apple's 2026 Guideline Changes](https://www.nakxi.com/blog/apple-2026-app-store-guideline-changes/)
- [Xcode 26 requirement (capgo)](https://capgo.app/blog/xcode-26-requirement-for-capacitor-apps/), [Apple’s 2026 SDK Requirement](https://www.appsonair.com/blogs/apples-2026-sdk-requirement-why-mobile-teams-should-not-wait-until-release-day)
- [SKIncludeConsumableInAppPurchaseHistory (Apple)](https://developer.apple.com/tutorials/data/documentation/bundleresources/information-property-list/skincludeconsumableinapppurchasehistory.md)
- [Apple privacy manifest in Expo](https://docs.expo.dev/guides/apple-privacy/)
- [EU DSA trader requirements (Apple)](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-compliance-information)
- [In-app purchase information: review screenshot and notes (Apple)](https://developer.apple.com/help/app-store-connect/manage-consumable-and-non-consumable-in-app-purchases/view-and-edit-in-app-purchase-information)
- [Restore purchases rejections (RevenueCat community)](https://community.revenuecat.com/sdks-51/we-get-rejected-from-apple-store-review-about-restore-purchases-693)
- [App Store Rejection Reasons 2026 (QAwerk)](https://qawerk.com/blog/app-store-rejection-reasons/)
