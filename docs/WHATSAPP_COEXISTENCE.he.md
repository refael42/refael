# חיבור הוואטסאפ האישי של מנהל הפרויקט (Coexistence)

המנהל ממשיך לדבר עם הקבלנים מהטלפון, כרגיל, באפליקציית **WhatsApp Business**. SiteFlow מקבלת עותק:
- **שיחות עם אנשי הפרויקט** (קבלנים או צוות שהטלפון שלהם רשום בפרויקט) נשמרות ומנותחות לעדכונים.
- **מספר אחר** רק נספר ("כתבו לך – לעקוב?"). התוכן שלו **לא נשמר** עד שבוחרים "עקוב".
- "התעלם" או "הפסק מעקב": מאותו רגע לא נשמר כלום. אפשר גם למחוק את מה שנשמר.
- קבוצות לא עוברות בחיבור הזה. אותן ממשיכים להעלות בייצוא.
- המערכת **לא שולחת** שום הודעה מהמספר של המנהל.

## הגדרה חד-פעמית

1. **Supabase ← SQL Editor:** להריץ את `supabase/migrations/20261016000014_whatsapp_links.sql`.
2. **Meta – האפליקציה שלנו** (developers.facebook.com ← My Apps ← SiteFlow):
   1. Add product ← **Facebook Login for Business** ← Configurations ← Create configuration ←
      בוחרים **WhatsApp Embedded Signup**. מעתיקים את ה-**Configuration ID**.
   2. App settings ← Basic: מעתיקים את ה-**App ID**.
      ב-**App domains** מוסיפים: `siteflow-snowy-omega.vercel.app`.
   3. Facebook Login for Business ← Settings: ב-**Allowed domains for the JavaScript SDK** מוסיפים
      `https://siteflow-snowy-omega.vercel.app`.
   4. WhatsApp ← Configuration ← Webhook fields: לסמן **messages**, **smb_message_echoes**,
      **history**, **smb_app_state_sync**.
3. **Vercel ← Settings ← Environment Variables:**
   - `NEXT_PUBLIC_META_APP_ID` = ה-App ID.
   - `NEXT_PUBLIC_META_ES_CONFIG_ID` = ה-Configuration ID.
   
   (`WHATSAPP_APP_SECRET` כבר מוגדר.) אחר כך Redeploy.
4. **המנהל:** "מקורות מידע" ← "חבר את הוואטסאפ שלי" ← מתחבר לפייסבוק ← בוחר "Connect your existing
   WhatsApp Business app" ← קוד ← סריקת QR מהאפליקציה ← מאשר שיתוף היסטוריה (עד כחצי שנה).

## אם Meta חוסמת
Meta עשויה לדרוש **אימות עסק** (Business Settings ← Security Center) או להעביר את האפליקציה למצב **Live**
לפני החיבור. ההודעה שמופיעה בחלון של Meta תגיד מה חסר.
