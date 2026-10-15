# מוצרים בתוך האפליקציה (In-App Products)

כל המוצרים הם **Consumable** (נצרכים: אפשר לקנות שוב ושוב). המזהים חייבים להיות **בדיוק** כמו כאן,
אחרת המשחק לא ימצא אותם (`src/data/shop.ts`, `src/data/offers.ts`).

| מזהה (Product ID) | יהלומים | מחיר מוצע | שם (עברית) | שם (English) |
|---|---|---|---|---|
| `gems80`   | 80   | ₪4.90  | חופן יהלומים   | Handful of Gems |
| `gems500`  | 500  | ₪19.90 | שקית יהלומים   | Bag of Gems |
| `gems1200` | 1200 | ₪39.90 | ארגז יהלומים   | Crate of Gems |
| `gems3000` | 3000 | ₪79.90 | אוצר יהלומים   | Treasure of Gems |

### חבילות מבצע (M34) — גם הן Consumable

| מזהה (Product ID) | מה יש בפנים | מחיר מוצע | שם (עברית) | שם (English) |
|---|---|---|---|---|
| `offer_starter` | 300 יהלומים + הגיבורה סאני | ₪9.90  | חבילת פתיחה | Starter Pack |
| `offer_hero`    | 800 יהלומים + גיבור/ת היומיים | ₪24.90 | גיבור/ת היומיים | Hero of the Moment |
| `offer_mega`    | 4000 יהלומים + גיבור/ת היומיים + 12 שעות הכנסה | ₪79.90 | חבילת מגה | Mega Pack |

- הגיבור/ה שבחבילה מתחלפ/ת כל יומיים (אותו דבר אצל כל השחקנים), לכן זה **מוצר אחד** ולא מוצר לכל גיבור.
- תיאור (עד 45 תווים): עברית `יהלומים ודמות מיתית שעובדת בחינם לתמיד` · English `Gems and a mythic hero who works for free`.
- בטופס של Apple ("Review Information") כדאי לכתוב: "The hero in the pack rotates every 48 hours; the timer in the app is real."

**תיאור לכל מוצר** (עד 45 תווים ב-App Store):
- עברית: `יהלומים לקיצורי דרך, עובדים כוכבים ובוסטים`
- English: `Gems for shortcuts, star workers and boosts`

**איפה מגדירים:**
- App Store Connect ← האפליקציה ← Monetization ← In-App Purchases ← ➕ ← Consumable.
- Google Play Console ← האפליקציה ← Monetize ← Products ← In-app products ← Create product.

**מחיר:** בוחרים את המדרגה הקרובה למחיר המוצע. המשחק מציג את המחיר שהחנות מחזירה (במטבע של השחקן), לא את המחיר שכתוב בקוד.
