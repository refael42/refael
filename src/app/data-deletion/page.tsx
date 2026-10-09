export const metadata = { title: "SiteFlow – מחיקת מידע" };

/** Public data-deletion instructions (Meta app settings). Open past the site password. */
export default function DataDeletionPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6 text-sm leading-7">
      <h1 className="text-xl font-bold">מחיקת מידע – SiteFlow</h1>
      <p>כדי למחוק את המידע שלכם מ-SiteFlow (שם, טלפון, אימייל, הודעות ותמונות) אפשר לבחור אחת מהדרכים:</p>
      <ol className="list-decimal ps-5">
        <li>לבקש ממנהל הפרויקט שהוסיף אתכם להסיר אתכם מהפרויקט ולמחוק את המידע.</li>
        <li>
          לשלוח &quot;מחק את המידע שלי&quot; למספר הוואטסאפ של SiteFlow, או לכתוב לנו דרך מנהל הפרויקט.
        </li>
      </ol>
      <p>המידע יימחק תוך 30 יום, למעט מה שנדרש לשמור לפי דין.</p>
      <hr className="my-2" />
      <h2 className="text-base font-semibold" dir="ltr">
        Data deletion instructions
      </h2>
      <p dir="ltr" className="text-start">
        To delete your SiteFlow data (name, phone, email, messages and photos), ask the project manager who added you, or send &quot;delete my
        data&quot; to the SiteFlow WhatsApp number. Your data will be deleted within 30 days, except where retention is required by law.
      </p>
    </main>
  );
}
