export const metadata = { title: "SiteFlow – מדיניות פרטיות" };

/**
 * Public privacy policy (required by Meta for the WhatsApp app). Open even
 * when the site password is on — see GATE_OPEN in middleware.ts.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6 text-sm leading-7">
      <h1 className="text-xl font-bold">מדיניות פרטיות – SiteFlow</h1>
      <p className="text-muted-foreground">עודכן: אוקטובר 2026</p>

      <p>
        SiteFlow היא מערכת לתיאום עבודות באתרי בנייה. מנהל הפרויקט מנהל בה משימות, וקבלנים מקבלים עדכונים ומדווחים על ביצוע – באפליקציה
        ובוואטסאפ.
      </p>

      <h2 className="text-base font-semibold">איזה מידע נאסף</h2>
      <ul className="list-disc ps-5">
        <li>שם, מספר טלפון ואימייל של אנשי הצוות והקבלנים, כפי שמנהל הפרויקט הזין.</li>
        <li>הודעות, תמונות, הודעות קוליות וקבצים שנשלחים בצ&apos;אט של הפרויקט או בוואטסאפ למספר של SiteFlow.</li>
        <li>נתוני המשימות והפרויקט (סטטוס, תאריכים, דיווחי סיום).</li>
      </ul>

      <h2 className="text-base font-semibold">למה המידע משמש</h2>
      <ul className="list-disc ps-5">
        <li>לשלוח לקבלן עדכונים על המשימות שלו ולקבל ממנו דיווחים.</li>
        <li>להציג למנהל הפרויקט את מצב העבודות באתר.</li>
        <li>הודעות עשויות להיות מעובדות בבינה מלאכותית (Anthropic Claude) כדי להציע למנהל הפרויקט עדכון משימה. שום שינוי לא נעשה בלי אישורו.</li>
      </ul>
      <p>המידע לא נמכר ולא משמש לפרסום.</p>

      <h2 className="text-base font-semibold">עם מי המידע משותף</h2>
      <p>
        רק עם ספקי השירות שמפעילים את המערכת: Supabase (אחסון נתונים), Vercel (שרת), Meta / WhatsApp (שליחת וקבלת הודעות), ו-Anthropic
        (עיבוד הודעות). המידע זמין רק לחברי אותו פרויקט.
      </p>

      <h2 className="text-base font-semibold">הפסקת הודעות</h2>
      <p>
        אפשר להפסיק לקבל הודעות SiteFlow בוואטסאפ בכל רגע: שלחו &quot;הסר&quot; למספר. כדי לחזור שלחו &quot;הצטרף&quot;.
      </p>

      <h2 id="delete" className="text-base font-semibold">
        מחיקת מידע
      </h2>
      <p>
        לבקשת מחיקה של המידע שלכם פנו למנהל הפרויקט, או כתבו &quot;מחק את המידע שלי&quot; למספר הוואטסאפ של SiteFlow – והמידע יימחק תוך 30
        יום, למעט מה שנדרש לשמור לפי דין.
      </p>

      <hr className="my-2" />
      <h2 className="text-base font-semibold" dir="ltr">
        Privacy Policy (English summary)
      </h2>
      <p dir="ltr" className="text-start">
        SiteFlow is a construction-site coordination tool. We store the names, phone numbers and emails of project staff and contractors as
        entered by the project manager, and the messages, photos and files exchanged in project chats and with the SiteFlow WhatsApp number.
        This data is used only to coordinate the project&apos;s work, may be processed by AI (Anthropic Claude) to suggest task updates that a
        manager approves, is shared only with our service providers (Supabase, Vercel, Meta/WhatsApp, Anthropic), and is never sold or used for
        advertising. Reply &quot;STOP&quot; to stop WhatsApp messages. To delete your data, ask the project manager or message the SiteFlow
        WhatsApp number; data is deleted within 30 days.
      </p>
    </main>
  );
}
