# מוצרים בתוך האפליקציה (In-App Products)

כל המוצרים הם **Consumable** (נצרכים: אפשר לקנות שוב ושוב). המזהים חייבים להיות **בדיוק** כמו כאן,
אחרת המשחק לא ימצא אותם (`src/data/shop.ts`).

| מזהה (Product ID) | יהלומים | מחיר מוצע | שם (עברית) | שם (English) |
|---|---|---|---|---|
| `gems80`   | 80   | ₪4.90  | חופן יהלומים   | Handful of Gems |
| `gems500`  | 500  | ₪19.90 | שקית יהלומים   | Bag of Gems |
| `gems1200` | 1200 | ₪39.90 | ארגז יהלומים   | Crate of Gems |
| `gems3000` | 3000 | ₪79.90 | אוצר יהלומים   | Treasure of Gems |

**תיאור לכל מוצר** (עד 45 תווים ב-App Store):
- עברית: `יהלומים לקיצורי דרך, עובדים כוכבים ובוסטים`
- English: `Gems for shortcuts, star workers and boosts`

**איפה מגדירים:**
- App Store Connect ← האפליקציה ← Monetization ← In-App Purchases ← ➕ ← Consumable.
- Google Play Console ← האפליקציה ← Monetize ← Products ← In-app products ← Create product.

**מחיר:** בוחרים את המדרגה הקרובה למחיר המוצע. המשחק מציג את המחיר שהחנות מחזירה (במטבע של השחקן), לא את המחיר שכתוב בקוד.
