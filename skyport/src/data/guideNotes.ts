/**
 * The inspector's notebook (the Aviation Guide): a line for each part of the
 * score, good, fair or poor, and one about the VIP care. First person, past
 * tense (no gendered words about the inspector in Hebrew).
 */
export type NoteKey =
  | `${'safety' | 'punctuality' | 'infrastructure' | 'service' | 'cleanliness' | 'comfort'}.${'good' | 'fair' | 'poor'}`
  | 'pick.right'
  | 'pick.wrong'
  | 'pick.none';

export interface GuideNote {
  key: NoteKey;
  en: string;
  he: string;
}

export const GUIDE_NOTES: readonly GuideNote[] = [
  // safety
  { key: 'safety.good', en: 'Every landing was butter. I checked twice.', he: 'כל נחיתה הייתה חמאה. בדקתי פעמיים.' },
  { key: 'safety.good', en: 'The tower sounded calm. That is the best compliment I give.', he: 'המגדל נשמע רגוע. זו המחמאה הכי גדולה שלי לשדה.' },
  { key: 'safety.good', en: 'Not one plane went around. Not one.', he: 'אף מטוס לא עשה סיבוב נוסף. אף לא אחד.' },
  { key: 'safety.fair', en: 'A go-around or two. Nothing scary, but I wrote it down.', he: 'סיבוב נוסף או שניים. שום דבר מפחיד, אבל רשמתי.' },
  { key: 'safety.fair', en: 'Mostly smooth skies, a few nervous moments.', he: 'רוב הזמן שמיים חלקים, כמה רגעים לחוצים.' },
  { key: 'safety.fair', en: 'The runway is safe. The schedule around it, less so.', he: 'המסלול בטוח. הלו"ז סביבו, פחות.' },
  { key: 'safety.poor', en: 'Planes were sent to other airports. That is a red line.', he: 'מטוסים נשלחו לשדות אחרים. זה קו אדום.' },
  { key: 'safety.poor', en: 'I counted more go-arounds than coffees. I drink a lot of coffee.', he: 'ספרתי יותר סיבובים נוספים מכוסות קפה. ואני שותה הרבה קפה.' },
  { key: 'safety.poor', en: 'The sky over this airport needs a traffic light.', he: 'השמיים מעל השדה הזה צריכים רמזור.' },
  // punctuality
  { key: 'punctuality.good', en: 'Left on time to the minute. I set my watch by it.', he: 'יצאנו בזמן עד הדקה. כיוונתי לפי זה את השעון.' },
  { key: 'punctuality.good', en: 'The board said ON TIME and meant it.', he: 'הלוח כתב "בזמן", והתכוון לזה.' },
  { key: 'punctuality.good', en: 'Turnarounds here are a ballet.', he: 'הטיפול במטוסים פה הוא בלט.' },
  { key: 'punctuality.fair', en: 'A few delays. The coffee was good, at least.', he: 'כמה עיכובים. לפחות הקפה היה טוב.' },
  { key: 'punctuality.fair', en: 'On time, more or less. Mostly more.', he: 'בזמן, פחות או יותר. בעיקר יותר.' },
  { key: 'punctuality.fair', en: 'The fuel truck and I met late. Twice.', he: 'נפגשנו באיחור, משאית הדלק ואני. פעמיים.' },
  { key: 'punctuality.poor', en: 'DELAYED is the word on every line of the board.', he: '"מתעכב" כתוב בכל שורה בלוח.' },
  { key: 'punctuality.poor', en: 'My flight left so late my hotel booking expired.', he: 'הטיסה יצאה כל כך מאוחר שההזמנה במלון פגה.' },
  { key: 'punctuality.poor', en: 'I wrote this whole notebook at the gate. Waiting.', he: 'כתבתי את כל המחברת הזאת בשער. מחכה.' },
  // infrastructure
  { key: 'infrastructure.good', en: 'Gates, jet bridges, trains. A real airport.', he: 'שערים, שרוולים, רכבות. שדה תעופה אמיתי.' },
  { key: 'infrastructure.good', en: 'Room for every plane, and then some.', he: 'מקום לכל מטוס, ועוד קצת.' },
  { key: 'infrastructure.good', en: 'Someone here thinks big, and builds bigger.', he: 'מישהו פה חושב בגדול, ובונה עוד יותר גדול.' },
  { key: 'infrastructure.fair', en: 'Solid. A few more stands would not hurt.', he: 'יציב. עוד כמה עמדות חניה לא יזיקו.' },
  { key: 'infrastructure.fair', en: 'Small but honest. Growing, I hope.', he: 'קטן אבל כן. גדל, אני מקווה.' },
  { key: 'infrastructure.fair', en: 'The terminal does its job. Nothing more yet.', he: 'הטרמינל עושה את העבודה. עדיין לא יותר מזה.' },
  { key: 'infrastructure.poor', en: 'A hut and a strip of dirt. Charming. Not a star.', he: 'צריף ורצועת עפר. מקסים. לא כוכב.' },
  { key: 'infrastructure.poor', en: 'Planes parked wherever they could. So did I.', he: 'מטוסים חנו איפה שיכלו. גם אני.' },
  { key: 'infrastructure.poor', en: 'Build more. Then call me again.', he: 'תבנו עוד. ואז תזמינו אותי שוב.' },
  // service
  { key: 'service.good', en: 'Through security before my coffee cooled down.', he: 'עברתי ביטחון לפני שהקפה התקרר.' },
  { key: 'service.good', en: 'My bag was on the belt before I was.', he: 'המזוודה הייתה על המסוע לפניי.' },
  { key: 'service.good', en: 'Short lines, kind staff. Rare and wonderful.', he: 'תורים קצרים וצוות נחמד. נדיר ונפלא.' },
  { key: 'service.fair', en: 'The check-in line was long, but it moved.', he: 'התור לצ\'ק-אין היה ארוך, אבל זז.' },
  { key: 'service.fair', en: 'Security took a while. I read half a novel.', he: 'הביטחון לקח זמן. קראתי חצי רומן.' },
  { key: 'service.fair', en: 'Bags arrived. Eventually. All of them, I think.', he: 'המזוודות הגיעו. בסוף. כולן, נדמה לי.' },
  { key: 'service.poor', en: 'I aged in the security line. Visibly.', he: 'הזדקנתי בתור לביטחון. רואים את זה.' },
  { key: 'service.poor', en: 'Bags went missing. Mine sends postcards.', he: 'מזוודות נעלמו. שלי שולחת לי גלויות.' },
  { key: 'service.poor', en: 'The line for check-in had its own weather.', he: 'לתור לצ\'ק-אין היה מזג אוויר משלו.' },
  // cleanliness
  { key: 'cleanliness.good', en: 'The floors shine. I saw my own reflection, judging me.', he: 'הרצפות מבריקות. ראיתי את ההשתקפות שלי, שופטת אותי.' },
  { key: 'cleanliness.good', en: 'Not a crumb. I looked under the benches.', he: 'אף פירור. הסתכלתי מתחת לספסלים.' },
  { key: 'cleanliness.good', en: 'The cleaners here deserve their own star.', he: 'לצוות הניקיון פה מגיע כוכב משלו.' },
  { key: 'cleanliness.fair', en: 'Clean enough. One wrapper near gate 2 stared at me.', he: 'נקי מספיק. עטיפה אחת ליד שער 2 בהתה בי.' },
  { key: 'cleanliness.fair', en: 'The bins were full but polite about it.', he: 'הפחים היו מלאים, אבל בנימוס.' },
  { key: 'cleanliness.fair', en: 'Some litter, some sparkle. A draw.', he: 'קצת לכלוך, קצת ברק. תיקו.' },
  { key: 'cleanliness.poor', en: 'Litter everywhere. One cup has lived here since spring.', he: 'לכלוך בכל מקום. כוס אחת גרה פה מהאביב.' },
  { key: 'cleanliness.poor', en: 'Hire a cleaner. Hire two.', he: 'תגייסו מנקה. תגייסו שניים.' },
  { key: 'cleanliness.poor', en: 'My shoes are still sticking to the floor of the hall.', he: 'הנעליים שלי עדיין דבוקות לרצפה של האולם.' },
  // comfort
  { key: 'comfort.good', en: 'Comfy seats, happy faces, nice music. I stayed an extra hour.', he: 'כיסאות נוחים, פרצופים שמחים, מוזיקה נעימה. נשארתי עוד שעה.' },
  { key: 'comfort.good', en: 'The passengers were smiling. At an airport!', he: 'הנוסעים חייכו. בשדה תעופה!' },
  { key: 'comfort.good', en: 'I would wait here for a delay. Almost.', he: 'הייתי מחכה פה לעיכוב. כמעט.' },
  { key: 'comfort.fair', en: 'Fine seats. A bit more joy would help.', he: 'כיסאות בסדר. קצת יותר שמחה תעזור.' },
  { key: 'comfort.fair', en: 'People seemed okay. Just okay.', he: 'האנשים נראו בסדר. רק בסדר.' },
  { key: 'comfort.fair', en: 'Comfortable, if you like plastic.', he: 'נוח, אם אוהבים פלסטיק.' },
  { key: 'comfort.poor', en: 'The passengers looked like they lost a bet.', he: 'הנוסעים נראו כאילו הפסידו בהתערבות.' },
  { key: 'comfort.poor', en: 'I sat on my suitcase. It was the best seat.', he: 'ישבתי על המזוודה. זה היה המושב הכי טוב.' },
  { key: 'comfort.poor', en: 'Grumpy faces everywhere. Mine too, by the end.', he: 'פרצופים חמוצים בכל מקום. גם שלי, בסוף.' },
  // the VIP care
  { key: 'pick.right', en: 'Someone recognized me and the staff were lovely. Well spotted.', he: 'מישהו זיהה אותי, והצוות היה מקסים. עין חדה.' },
  { key: 'pick.right', en: 'The VIP care was perfect. I pretended to be surprised.', he: 'טיפול ה-VIP היה מושלם. העמדתי פנים שהופתעתי.' },
  { key: 'pick.right', en: 'They found me. I will not say how, but I am impressed.', he: 'מצאו אותי. לא אגיד איך, אבל זה מרשים.' },
  { key: 'pick.wrong', en: 'The staff spoiled someone else. Lucky them.', he: 'הצוות פינק מישהו אחר. איזה מזל לו.' },
  { key: 'pick.wrong', en: 'A stranger got the VIP care. I got the line.', he: 'זר קיבל טיפול VIP. אני קיבלתי את התור.' },
  { key: 'pick.wrong', en: 'Nice try. Wrong passenger.', he: 'ניסיון יפה. נוסע לא נכון.' },
  { key: 'pick.none', en: 'Nobody noticed me. Perfect for my work.', he: 'אף אחד לא שם לב אליי. מושלם לעבודה שלי.' },
  { key: 'pick.none', en: 'I came, I saw, I left. Unrecognized.', he: 'באתי, ראיתי, הלכתי. בלי שזיהו אותי.' },
  { key: 'pick.none', en: 'The rumor went round. Nobody acted on it.', he: 'השמועה עברה בשדה. אף אחד לא עשה איתה כלום.' },
];

/** Note indices by key. */
export const NOTES_BY: Readonly<Record<NoteKey, number[]>> = (() => {
  const out = {} as Record<NoteKey, number[]>;
  GUIDE_NOTES.forEach((n, i) => (out[n.key] ??= []).push(i));
  return out;
})();
