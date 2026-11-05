/**
 * Passenger reviews (M12): short lines by topic, in English and Hebrew, each
 * with its stars. The sim picks a topic from what happened on a flight (a lost
 * bag, a late departure, long lines, a dirty hall, a jet bridge, the people
 * mover...) and a line of that topic by hash.
 */

export type ReviewTopic =
  | 'queue'
  | 'lostBag'
  | 'late'
  | 'onTime'
  | 'smooth'
  | 'dirty'
  | 'clean'
  | 'food'
  | 'dutyFree'
  | 'jetBridge'
  | 'bus'
  | 'train'
  | 'apm'
  | 'hotel'
  | 'airTaxi'
  | 'jumbo'
  | 'family'
  | 'business'
  | 'student'
  | 'elder'
  | 'vip'
  | 'weather'
  | 'holiday'
  | 'dirtStrip'
  | 'bigAirport'
  | 'passport'
  | 'carousel';

export interface ReviewLine {
  topic: ReviewTopic;
  stars: number;
  en: string;
  he: string;
}

const L = (topic: ReviewTopic, stars: number, en: string, he: string): ReviewLine => ({ topic, stars, en, he });

export const REVIEWS: readonly ReviewLine[] = [
  // long lines at check-in and security
  L('queue', 1, 'I waited in the security line so long my passport expired.', 'חיכיתי בבידוק כל כך הרבה שהדרכון שלי פג תוקף.'),
  L('queue', 1, 'Made three friends in the check-in line. We are planning a reunion.', 'הכרתי שלושה חברים בתור לצ׳ק-אין. אנחנו כבר מתכננים מפגש מחזור.'),
  L('queue', 2, 'The line was so long it had its own weather.', 'התור היה כל כך ארוך שהיה לו מזג אוויר משלו.'),
  L('queue', 2, 'Good airport. I think. I only saw the queue.', 'שדה טוב. אני חושב. ראיתי רק את התור.'),
  L('queue', 1, 'Arrived for my flight, left for my retirement.', 'הגעתי לטיסה, יצאתי לפנסיה.'),
  L('queue', 2, 'The rope maze is fun the first four times.', 'מבוך החבלים כיף בארבע הפעמים הראשונות.'),
  L('queue', 2, 'One counter open, nine people behind it chatting. Classic.', 'דלפק אחד פתוח, תשעה אנשים מאחוריו מפטפטים. קלאסיקה.'),
  L('queue', 1, 'My sandwich went off while I waited at security.', 'הכריך שלי התקלקל בזמן שחיכיתי בבידוק.'),
  L('queue', 2, 'I learned to knit in the line. Made a scarf. Then a sweater.', 'למדתי לסרוג בתור. סרגתי צעיף. אחר כך סוודר.'),
  L('queue', 2, 'The scanner beeped at my belt, my shoes and my mood.', 'הסורק צפצף על החגורה, על הנעליים ועל מצב הרוח שלי.'),
  L('queue', 1, 'Please, more lanes. My kids grew a size in the queue.', 'בבקשה, עוד עמדות. הילדים שלי גדלו מידה בתור.'),
  L('queue', 2, 'The line moved. Eventually. Like a glacier.', 'התור זז. בסוף. כמו קרחון.'),
  L('queue', 2, 'Nice floor tiles. I had time to count them all.', 'אריחים יפים ברצפה. היה לי זמן לספור את כולם.'),
  L('queue', 1, 'By the time I reached the counter, they knew my life story.', 'עד שהגעתי לדלפק, כבר ידעו את סיפור חיי.'),
  L('queue', 2, 'Long line, but the person behind me had snacks. Saved.', 'תור ארוך, אבל למי שעמד מאחוריי היו חטיפים. ניצלתי.'),
  L('queue', 2, 'Security took so long I forgot where I was flying.', 'הבידוק לקח כל כך הרבה זמן ששכחתי לאן אני טס.'),
  // a bag that missed the flight
  L('lostBag', 1, 'My suitcase has seen more countries than I have.', 'המזוודה שלי ראתה יותר מדינות ממני.'),
  L('lostBag', 1, 'I landed. My bag is still on holiday somewhere.', 'נחתתי. המזוודה שלי עדיין בחופשה איפשהו.'),
  L('lostBag', 2, 'Bag arrived two days later, with a tan.', 'המזוודה הגיעה יומיים אחריי, שזופה.'),
  L('lostBag', 1, 'Packed for the beach. Wearing the airplane blanket.', 'ארזתי לחוף. לובש את השמיכה מהמטוס.'),
  L('lostBag', 1, 'My bag took a different flight. It always was the adventurous one.', 'המזוודה שלי לקחה טיסה אחרת. תמיד היא הייתה ההרפתקנית.'),
  L('lostBag', 2, 'Lost my bag, found my inner peace. Two stars.', 'איבדתי את המזוודה, מצאתי שלווה פנימית. שני כוכבים.'),
  L('lostBag', 1, 'The carousel went round forty times. My bag never came.', 'המסוע הסתובב ארבעים פעם. המזוודה שלי לא הגיעה.'),
  L('lostBag', 2, 'They found my bag! In another city. Progress.', 'מצאו את המזוודה! בעיר אחרת. התקדמות.'),
  L('lostBag', 1, 'Checked in late, bag stayed home. Apparently it was my fault.', 'עשיתי צ׳ק-אין מאוחר, המזוודה נשארה בבית. מסתבר שזו אשמתי.'),
  L('lostBag', 2, 'My bag has more air miles than me now.', 'למזוודה שלי יש עכשיו יותר נקודות נוסע מתמיד ממני.'),
  L('lostBag', 1, 'Toothbrush in the bag. Bag in the void.', 'מברשת השיניים במזוודה. המזוודה בחלל.'),
  L('lostBag', 2, 'Watched every bag but mine. Very educational.', 'ראיתי את כל המזוודות חוץ משלי. מאוד מחנך.'),
  L('lostBag', 1, 'Dear bag, if you read this, please come home.', 'מזוודה יקרה, אם את קוראת את זה, בבקשה תחזרי הביתה.'),
  L('lostBag', 2, 'The bag cart came, the bag cart went. My bag did not.', 'עגלת המטען באה, עגלת המטען הלכה. המזוודה שלי לא.'),
  // a late departure
  L('late', 2, 'Late again. I could have walked there by now.', 'שוב באיחור. כבר הייתי מגיע ברגל.'),
  L('late', 2, 'We left so late it was technically tomorrow.', 'יצאנו כל כך מאוחר שזה כבר היה בעצם מחר.'),
  L('late', 1, 'Missed my connection, my meeting and my birthday.', 'פספסתי את הטיסה ההמשך, את הפגישה ואת יום ההולדת שלי.'),
  L('late', 2, 'The plane was ready. The airport was not.', 'המטוס היה מוכן. השדה לא.'),
  L('late', 2, 'They announced a short delay. It was not short.', 'הודיעו על עיכוב קצר. הוא לא היה קצר.'),
  L('late', 2, 'Waited for fuel like it was coming by bicycle.', 'חיכינו לדלק כאילו הוא מגיע באופניים.'),
  L('late', 1, 'Departure time is more of a suggestion here.', 'שעת ההמראה פה היא יותר בגדר המלצה.'),
  L('late', 2, 'We sat on the plane long enough to finish the whole movie.', 'ישבנו במטוס מספיק זמן לסיים את כל הסרט.'),
  L('late', 2, 'The pilot apologised so many times I started apologising too.', 'הטייס התנצל כל כך הרבה פעמים שגם אני התחלתי להתנצל.'),
  L('late', 2, 'Late, but the sunset from the window was lovely.', 'באיחור, אבל השקיעה מהחלון הייתה יפה.'),
  L('late', 1, 'I was told "any minute now" eleven times.', 'אמרו לי "עוד רגע" אחת עשרה פעמים.'),
  L('late', 2, 'Waiting for takeoff clearance felt like waiting for exam results.', 'לחכות לאישור המראה הרגיש כמו לחכות לתוצאות בחינה.'),
  L('late', 2, 'The bags were loaded slower than my old laptop boots.', 'המזוודות הועמסו לאט יותר מהמחשב הישן שלי נדלק.'),
  L('late', 2, 'An hour late. The airline sent a cookie. One cookie.', 'שעה באיחור. חברת התעופה שלחה עוגייה. עוגייה אחת.'),
  // on time
  L('onTime', 5, 'Left on time to the minute. I did not know that was possible.', 'יצאנו בדיוק בזמן. לא ידעתי שזה אפשרי.'),
  L('onTime', 4, 'Punctual, polite, painless. Three Ps, four stars.', 'מדויק, מנומס, בלי כאב ראש. ארבעה כוכבים.'),
  L('onTime', 5, 'On time. I had to wait for my own taxi on the other side.', 'בזמן. בצד השני אני חיכיתי למונית ולא היא לי.'),
  L('onTime', 4, 'We pushed back right on schedule. Swiss watch energy.', 'התנתקנו מהשער בדיוק לפי הלוח. אנרגיה של שעון שוויצרי.'),
  L('onTime', 5, 'Fuel, bags, boarding, takeoff. Like a dance.', 'דלק, מזוודות, עלייה, המראה. כמו ריקוד.'),
  L('onTime', 4, 'Early, even. I did not know what to do with myself.', 'אפילו מוקדם. לא ידעתי מה לעשות עם עצמי.'),
  L('onTime', 5, 'The board said ON TIME and it meant it.', 'הלוח אמר בזמן והוא התכוון לזה.'),
  L('onTime', 4, 'Smooth turnaround, I timed it. I am that kind of passenger.', 'הסבב בקרקע היה חלק, מדדתי. אני הנוסע הזה.'),
  L('onTime', 5, 'The tower cleared us the second we were ready. Bravo.', 'המגדל אישר לנו ברגע שהיינו מוכנים. כל הכבוד.'),
  L('onTime', 4, 'Never been so bored on time. Compliment.', 'אף פעם לא השתעממתי ככה בזמן. זו מחמאה.'),
  L('onTime', 5, 'I made my meeting with time for coffee. Thank you!', 'הגעתי לפגישה עם זמן לקפה. תודה!'),
  L('onTime', 4, 'Right on time. My grandma will be disappointed she did not get to complain.', 'בדיוק בזמן. סבתא שלי תתאכזב שלא היה לה על מה להתלונן.'),
  // a great trip overall
  L('smooth', 5, 'Best airport I have ever been bored in. Wait, I was not even bored.', 'השדה הכי טוב שהשתעממתי בו. רגע, אפילו לא השתעממתי.'),
  L('smooth', 5, 'Everything just worked. Suspiciously well.', 'הכול פשוט עבד. באופן חשוד.'),
  L('smooth', 5, 'From the curb to my seat in record time. Ten out of ten.', 'מהמדרכה למושב בזמן שיא. עשר מעשר.'),
  L('smooth', 5, 'Staff smiled. Lines moved. Planes flew. Is this a dream?', 'הצוות חייך. התורים זזו. המטוסים טסו. זה חלום?'),
  L('smooth', 4, 'Pleasant, quick, and the floors were shiny. Will fly again.', 'נעים, מהיר, והרצפות הבריקו. אטוס שוב.'),
  L('smooth', 5, 'I would come here even if I was not flying anywhere.', 'הייתי בא לפה גם בלי לטוס לשום מקום.'),
  L('smooth', 5, 'My kids behaved. That is how good this airport is.', 'הילדים שלי התנהגו יפה. עד כדי כך השדה הזה טוב.'),
  L('smooth', 4, 'Easy in, easy out. Like a good song.', 'קל להיכנס, קל לצאת. כמו שיר טוב.'),
  L('smooth', 5, 'Five stars. I would give six but the app will not let me.', 'חמישה כוכבים. הייתי נותן שישה אבל האפליקציה לא נותנת.'),
  L('smooth', 5, 'The whole trip felt like a well-oiled machine with a smile.', 'כל הטיול הרגיש כמו מכונה משומנת עם חיוך.'),
  L('smooth', 4, 'Nothing went wrong. I am almost disappointed, no story to tell.', 'שום דבר לא השתבש. כמעט מאכזב, אין לי מה לספר.'),
  L('smooth', 5, 'Even the toilets were nice. That never happens.', 'אפילו השירותים היו נחמדים. זה אף פעם לא קורה.'),
  L('smooth', 5, 'Airport of my dreams. Literally, I fell asleep happy at the gate.', 'שדה החלומות שלי. ממש, נרדמתי מאושר ליד השער.'),
  L('smooth', 4, 'Good signs, short walks, friendly faces. Bravo.', 'שלטים טובים, הליכות קצרות, פרצופים נחמדים. כל הכבוד.'),
  L('smooth', 5, 'I told my friends about this airport. They think I am weird.', 'סיפרתי לחברים על השדה הזה. הם חושבים שאני מוזר.'),
  L('smooth', 5, 'Chef kiss for the whole team. Mwah.', 'נשיקת שף לכל הצוות. מוואה.'),
  // dirty halls
  L('dirty', 2, 'Found a cup, a wrapper and somebody\'s sandwich under my seat.', 'מצאתי כוס, עטיפה וכריך של מישהו מתחת למושב.'),
  L('dirty', 1, 'The floor was sticky. My shoe is still there.', 'הרצפה הייתה דביקה. הנעל שלי עדיין שם.'),
  L('dirty', 2, 'Lovely lounge, if you like litter art.', 'טרקלין מקסים, אם אתם אוהבים אמנות מפסולת.'),
  L('dirty', 2, 'Please hire a cleaner. Or two. Or ten.', 'בבקשה תשכרו מנקה. או שניים. או עשרה.'),
  L('dirty', 1, 'I tripped over a can and nearly missed my flight.', 'מעדתי על פחית וכמעט פספסתי את הטיסה.'),
  L('dirty', 2, 'The food court looked like a food fight.', 'מתחם האוכל נראה כמו מלחמת אוכל.'),
  L('dirty', 2, 'Bins: few. Litter: many.', 'פחים: מעט. לכלוך: הרבה.'),
  L('dirty', 1, 'Pigeons came inside for the buffet.', 'יונים נכנסו פנימה בשביל המזנון.'),
  L('dirty', 2, 'Nice building, messy floors. Fix it and I will be back.', 'בניין יפה, רצפות מלוכלכות. תתקנו ואחזור.'),
  L('dirty', 2, 'I played hopscotch around the wrappers. Fun, but no.', 'קפצתי בין העטיפות. כיף, אבל לא.'),
  L('dirty', 1, 'The gate lounge had more cups than people.', 'באזור השער היו יותר כוסות מאנשים.'),
  L('dirty', 2, 'Spotted a cleaner! Just one. Brave soul.', 'ראיתי מנקה! רק אחד. נשמה אמיצה.'),
  // clean halls
  L('clean', 5, 'So clean I could eat off the floor. I did not. But I could.', 'כל כך נקי שיכולתי לאכול מהרצפה. לא אכלתי. אבל יכולתי.'),
  L('clean', 5, 'Spotless! The cleaners deserve a raise.', 'מבריק! מגיעה למנקים העלאה.'),
  L('clean', 4, 'Clean halls, fresh air, happy me.', 'אולמות נקיים, אוויר נקי, אני מאושר.'),
  L('clean', 5, 'Watched a cleaner pick up a cup before it touched the floor.', 'ראיתי מנקה מרים כוס עוד לפני שהיא נגעה ברצפה.'),
  L('clean', 4, 'The floors shine so much I saw my own face. Tired, but shiny.', 'הרצפות מבריקות כל כך שראיתי את הפנים שלי. עייף, אבל מבריק.'),
  L('clean', 5, 'Tidiest airport I know. My mother would approve.', 'השדה הכי מסודר שאני מכיר. אמא שלי הייתה מאשרת.'),
  L('clean', 4, 'Bins everywhere. I almost ran out of things to throw away.', 'פחים בכל מקום. כמעט נגמרו לי דברים לזרוק.'),
  L('clean', 5, 'Clean, calm and quiet. Like a library with planes.', 'נקי, רגוע ושקט. כמו ספרייה עם מטוסים.'),
  L('clean', 4, 'The cleaning team waved at me. I waved back. Lovely.', 'צוות הניקיון נופף לי. נופפתי בחזרה. מקסים.'),
  L('clean', 5, 'Not one wrapper in sight. Who are you people?', 'אף עטיפה באופק. מי אתם בכלל?'),
  // the food court and the kiosk
  L('food', 4, 'The kiosk coffee saved my morning and my marriage.', 'הקפה מהקיוסק הציל לי את הבוקר ואת הנישואים.'),
  L('food', 4, 'Good falafel at the gate. Did not expect that.', 'פלאפל טוב ליד השער. לא ציפיתי.'),
  L('food', 5, 'The food court has everything. I ate everything.', 'במתחם האוכל יש הכול. אכלתי הכול.'),
  L('food', 3, 'Airport prices, airport sandwich. You know.', 'מחירים של שדה, כריך של שדה. אתם יודעים.'),
  L('food', 4, 'Fresh pastries. My diet missed the flight.', 'מאפים טריים. הדיאטה שלי פספסה את הטיסה.'),
  L('food', 5, 'Best hummus I have had in a terminal. Maybe anywhere.', 'החומוס הכי טוב שאכלתי בטרמינל. אולי בכלל.'),
  L('food', 4, 'Ate, drank, people-watched. A perfect hour.', 'אכלתי, שתיתי, הסתכלתי על אנשים. שעה מושלמת.'),
  L('food', 3, 'The smoothie was green. I am not sure why.', 'השייק היה ירוק. אני לא בטוח למה.'),
  L('food', 4, 'Pizza at 6 am. No judgement here. Thank you.', 'פיצה בשש בבוקר. בלי שיפוטיות. תודה.'),
  L('food', 4, 'They remembered my order from last time. Frequent flyer life.', 'זכרו את ההזמנה שלי מהפעם הקודמת. חיים של נוסע מתמיד.'),
  // the duty free
  L('dutyFree', 4, 'Went in for gum, came out with perfume, chocolate and a hat.', 'נכנסתי בשביל מסטיק, יצאתי עם בושם, שוקולד וכובע.'),
  L('dutyFree', 5, 'The duty free is a maze and I loved getting lost.', 'הדיוטי פרי הוא מבוך ונהניתי ללכת בו לאיבוד.'),
  L('dutyFree', 4, 'Smelled every perfume. I now smell like a garden.', 'הרחתי כל בושם. עכשיו אני מריח כמו גינה.'),
  L('dutyFree', 3, 'Spent my holiday budget before the holiday. Oops.', 'בזבזתי את תקציב החופשה לפני החופשה. אופס.'),
  L('dutyFree', 4, 'Giant chocolate bar for the price of a small one. Science.', 'חפיסת שוקולד ענקית במחיר של קטנה. מדע.'),
  L('dutyFree', 5, 'Bought gifts for everyone. I am the favourite now.', 'קניתי מתנות לכולם. עכשיו אני האהוב.'),
  L('dutyFree', 4, 'You have to walk through the shop to reach the gate. Clever.', 'צריך לעבור בחנות כדי להגיע לשער. מתוחכם.'),
  L('dutyFree', 4, 'The cashier wished me a good flight in three languages.', 'הקופאית איחלה לי טיסה טובה בשלוש שפות.'),
  L('dutyFree', 3, 'Nice shops, but my wallet filed a complaint.', 'חנויות יפות, אבל הארנק שלי הגיש תלונה.'),
  L('dutyFree', 5, 'Tried five sunglasses, bought six. Happy.', 'מדדתי חמישה זוגות משקפי שמש, קניתי שישה. מרוצה.'),
  // jet bridges
  L('jetBridge', 5, 'Straight from the gate onto the plane. No rain, no stairs. Bliss.', 'ישר מהשער למטוס. בלי גשם, בלי מדרגות. אושר.'),
  L('jetBridge', 5, 'The jet bridge made me feel like a VIP.', 'גשר העלייה גרם לי להרגיש VIP.'),
  L('jetBridge', 4, 'Walked onto the plane like walking into my living room.', 'נכנסתי למטוס כמו לסלון שלי.'),
  L('jetBridge', 5, 'Jet bridge plus a window seat. Perfect start.', 'גשר עלייה ומושב חלון. התחלה מושלמת.'),
  L('jetBridge', 4, 'No bus, no stairs, no fuss. Good airport.', 'בלי אוטובוס, בלי מדרגות, בלי בלגן. שדה טוב.'),
  L('jetBridge', 5, 'Gate to seat in two minutes. My grandma made it too.', 'מהשער למושב בשתי דקות. גם סבתא שלי הספיקה.'),
  L('jetBridge', 4, 'The tunnel to the plane always makes me feel like an astronaut.', 'המנהרה למטוס תמיד גורמת לי להרגיש אסטרונאוט.'),
  L('jetBridge', 5, 'Dry shoes on a rainy day. Thank you, jet bridge.', 'נעליים יבשות ביום גשום. תודה, גשר עלייה.'),
  // the apron bus
  L('bus', 3, 'The bus ride to the plane was longer than the flight.', 'הנסיעה באוטובוס למטוס הייתה ארוכה מהטיסה.'),
  L('bus', 3, 'Standing on the apron bus with my nose in a stranger\'s backpack.', 'עומד באוטובוס הרחבה עם האף בתרמיל של זר.'),
  L('bus', 4, 'Got to see the planes up close from the bus. Fun!', 'ראיתי את המטוסים מקרוב מהאוטובוס. כיף!'),
  L('bus', 3, 'Bus, stairs, wind in my hair. Very retro.', 'אוטובוס, מדרגות, רוח בשיער. מאוד רטרו.'),
  L('bus', 4, 'The bus driver waved at every plane. Best part of the trip.', 'נהג האוטובוס נופף לכל מטוס. החלק הכי טוב בטיול.'),
  L('bus', 2, 'Waited for the bus, waited in the bus, waited off the bus.', 'חיכיתי לאוטובוס, חיכיתי באוטובוס, חיכיתי אחרי האוטובוס.'),
  L('bus', 3, 'Climbing the stairs with a suitcase is a sport.', 'לטפס במדרגות עם מזוודה זה ספורט.'),
  L('bus', 4, 'A little bus tour of the airport, free of charge.', 'סיור קטן באוטובוס בשדה, חינם.'),
  // the railway
  L('train', 4, 'Train right to the terminal. No traffic, no parking. Smart.', 'רכבת עד הטרמינל. בלי פקקים, בלי חניה. חכם.'),
  L('train', 5, 'Hopped off the train and was at check-in in two minutes.', 'ירדתי מהרכבת והייתי בצ׳ק-אין תוך שתי דקות.'),
  L('train', 4, 'The station has a glass roof. You can watch the trains. Nice touch.', 'לתחנה יש גג זכוכית. אפשר לראות את הרכבות. נגיעה יפה.'),
  L('train', 3, 'Missed my train by a minute. The next one came quickly though.', 'פספסתי את הרכבת בדקה. אבל הבאה הגיעה מהר.'),
  L('train', 4, 'Train, terminal, plane. Like a well-planned city.', 'רכבת, טרמינל, מטוס. כמו עיר מתוכננת היטב.'),
  L('train', 5, 'Took the train with my bags, no stress at all.', 'נסעתי ברכבת עם המזוודות, בלי שום לחץ.'),
  L('train', 4, 'Watching the train come out of the tunnel never gets old.', 'לראות את הרכבת יוצאת מהמנהרה זה לא נמאס אף פעם.'),
  L('train', 4, 'Cheaper than a taxi and faster too. Win.', 'זול ממונית וגם מהיר יותר. ניצחון.'),
  // the people mover to the satellite
  L('apm', 5, 'A little train inside the airport! I felt like a kid.', 'רכבת קטנה בתוך שדה התעופה! הרגשתי כמו ילד.'),
  L('apm', 5, 'The people mover is quiet, fast and has the best view of the apron.', 'הרכבת הפנימית שקטה, מהירה ועם הנוף הכי טוב לרחבה.'),
  L('apm', 4, 'Rode the train to Concourse D twice. Just for fun.', 'נסעתי ברכבת לזרוע D פעמיים. סתם בשביל הכיף.'),
  L('apm', 5, 'No long walk to the far gates. The train does it for you.', 'בלי הליכה ארוכה לשערים הרחוקים. הרכבת עושה את זה בשבילך.'),
  L('apm', 4, 'My son wants to work at the airport now. As the train.', 'הבן שלי רוצה לעבוד בשדה עכשיו. בתור הרכבת.'),
  L('apm', 5, 'Doors open, step in, glide over. Futuristic.', 'הדלתות נפתחות, נכנסים, מחליקים. עתידני.'),
  L('apm', 4, 'Concourse D is lovely and the ride there is half the fun.', 'זרוע D מקסימה והנסיעה אליה היא חצי מהכיף.'),
  L('apm', 5, 'Best seat in the airport: the front of the people mover.', 'המושב הכי טוב בשדה: החלק הקדמי של הרכבת הפנימית.'),
  // the airport hotel
  L('hotel', 4, 'Slept at the airport hotel, walked to the terminal in my slippers.', 'ישנתי במלון של השדה, הלכתי לטרמינל בנעלי בית.'),
  L('hotel', 5, 'Room with a runway view. Fell asleep counting planes.', 'חדר עם נוף למסלול. נרדמתי בזמן שספרתי מטוסים.'),
  L('hotel', 4, 'Early flight, no stress: hotel, coffee, gate. Done.', 'טיסה מוקדמת, בלי לחץ: מלון, קפה, שער. סיימנו.'),
  L('hotel', 4, 'The hotel fountain is very relaxing before a long flight.', 'המזרקה של המלון מאוד מרגיעה לפני טיסה ארוכה.'),
  L('hotel', 5, 'Breakfast, then a two-minute walk to check-in. Perfect.', 'ארוחת בוקר, ואז שתי דקות הליכה לצ׳ק-אין. מושלם.'),
  L('hotel', 4, 'The star on the hotel roof guided me home. Poetic.', 'הכוכב על גג המלון הנחה אותי הביתה. פואטי.'),
  // air taxis
  L('airTaxi', 5, 'Flew in from the city on an air taxi. I am never driving again.', 'טסתי מהעיר במונית אווירית. אני לא נוהג יותר אף פעם.'),
  L('airTaxi', 5, 'Four rotors, zero traffic jams. The future is here.', 'ארבעה רוטורים, אפס פקקים. העתיד כבר כאן.'),
  L('airTaxi', 4, 'The air taxi was so quiet the birds did not notice.', 'המונית האווירית הייתה שקטה כל כך שהציפורים לא שמו לב.'),
  L('airTaxi', 5, 'Landed on a pad with blue lights. Felt like a movie.', 'נחתנו על מנחת עם אורות כחולים. הרגשתי כמו בסרט.'),
  L('airTaxi', 4, 'Pricey, but I skipped the whole highway. Worth it.', 'יקר, אבל דילגתי על כל הכביש המהיר. שווה.'),
  L('airTaxi', 5, 'My kids still talk about the flying taxi.', 'הילדים שלי עדיין מדברים על המונית המעופפת.'),
  L('airTaxi', 4, 'Tiny cabin, giant view.', 'תא קטנטן, נוף ענק.'),
  L('airTaxi', 5, 'From my office roof to the airport in ten minutes. Wow.', 'מהגג של המשרד לשדה בעשר דקות. וואו.'),
  // the jumbos at Terminal 4
  L('jumbo', 5, 'Terminal 4 is huge and so is the plane. Two decks!', 'טרמינל 4 ענק וגם המטוס. שתי קומות!'),
  L('jumbo', 5, 'Boarding a jumbo through the jet bridge felt like entering a ship.', 'לעלות לג׳מבו דרך גשר העלייה הרגיש כמו להיכנס לאונייה.'),
  L('jumbo', 4, 'So many passengers, yet the lines were short. Impressive.', 'כל כך הרבה נוסעים, ובכל זאת התורים היו קצרים. מרשים.'),
  L('jumbo', 5, 'Watched the Condor take off. The ground shook. Goosebumps.', 'ראיתי את הקונדור ממריא. האדמה רעדה. צמרמורת.'),
  L('jumbo', 4, 'Long-haul from a terminal of its own. Very civilised.', 'טיסה ארוכה מטרמינל משלה. מאוד מתורבת.'),
  L('jumbo', 5, 'Biggest plane I have ever flown. Smoothest too.', 'המטוס הכי גדול שטסתי בו. גם הכי חלק.'),
  // families
  L('family', 4, 'Traveling with three kids and nobody cried. Not even me.', 'טסתי עם שלושה ילדים ואף אחד לא בכה. אפילו לא אני.'),
  L('family', 5, 'The play corner at the gate is a lifesaver.', 'פינת המשחקים ליד השער מצילה חיים.'),
  L('family', 3, 'The kids loved the planes. I loved the coffee.', 'הילדים אהבו את המטוסים. אני אהבתי את הקפה.'),
  L('family', 4, 'Stroller-friendly, toilet-friendly, parent-friendly.', 'ידידותי לעגלות, לשירותים ולהורים.'),
  L('family', 3, 'My toddler pressed every button in the terminal. Sorry.', 'הפעוט שלי לחץ על כל כפתור בטרמינל. סליחה.'),
  L('family', 5, 'Grandma, the kids and the dog all made it. Miracle.', 'סבתא, הילדים והכלב, כולם הגיעו. נס.'),
  L('family', 4, 'The staff gave my daughter a sticker. She is now a pilot.', 'הצוות נתן לבת שלי מדבקה. עכשיו היא טייסת.'),
  L('family', 3, 'Family of six, twelve bags. We did it, somehow.', 'משפחה של שישה, שתים עשרה מזוודות. עשינו את זה, איכשהו.'),
  L('family', 4, 'Kids watched the bag carts like it was a cartoon.', 'הילדים הסתכלו על עגלות המטען כאילו זה סרט מצויר.'),
  L('family', 5, 'Easiest family trip we have ever had. Thank you!', 'הטיול המשפחתי הכי קל שהיה לנו. תודה!'),
  // business travellers
  L('business', 4, 'Fast security, good Wi-Fi, quiet lounge. All I need.', 'בידוק מהיר, אינטרנט טוב, טרקלין שקט. כל מה שאני צריך.'),
  L('business', 5, 'Answered forty emails in the lounge. Productive airport.', 'עניתי על ארבעים מיילים בטרקלין. שדה פרודוקטיבי.'),
  L('business', 4, 'In and out like a well-run meeting.', 'נכנסתי ויצאתי כמו פגישה מנוהלת היטב.'),
  L('business', 3, 'Fine airport. My laptop battery disagreed.', 'שדה בסדר. הסוללה של המחשב לא הסכימה.'),
  L('business', 5, 'I fly every week. This is my favourite terminal.', 'אני טס כל שבוע. זה הטרמינל האהוב עליי.'),
  L('business', 4, 'Efficient. The board was right. The coffee was strong.', 'יעיל. הלוח צדק. הקפה היה חזק.'),
  L('business', 4, 'Closed a deal on the phone at the gate. Lucky airport.', 'סגרתי עסקה בטלפון ליד השער. שדה מביא מזל.'),
  L('business', 3, 'Good, but where are the power sockets?', 'טוב, אבל איפה השקעים?'),
  L('business', 5, 'Lounge sofas so comfy I almost missed the boarding call.', 'הספות בטרקלין כל כך נוחות שכמעט פספסתי את הקריאה לעלייה.'),
  L('business', 4, 'Smooth as a spreadsheet with no errors.', 'חלק כמו גיליון אקסל בלי שגיאות.'),
  // students
  L('student', 4, 'Slept on three seats at the gate. Great airport for budgets.', 'ישנתי על שלושה מושבים ליד השער. שדה מעולה לתקציב נמוך.'),
  L('student', 3, 'Backpack fit in the overhead. Life is good.', 'התרמיל נכנס לתא העליון. החיים יפים.'),
  L('student', 4, 'Free water fountain! Student heaven.', 'ברזייה בחינם! גן עדן של סטודנטים.'),
  L('student', 3, 'Spent my last coins on a pretzel. Worth it.', 'בזבזתי את המטבעות האחרונים על בייגלה. היה שווה.'),
  L('student', 4, 'Met people from four countries at the gate. Good vibes.', 'פגשתי אנשים מארבע מדינות ליד השער. אווירה טובה.'),
  L('student', 3, 'Cheap flight, nice airport, long nap.', 'טיסה זולה, שדה נחמד, תנומה ארוכה.'),
  L('student', 4, 'The train to the terminal saved my budget.', 'הרכבת לטרמינל הצילה לי את התקציב.'),
  L('student', 4, 'Charged my phone, my laptop and my soul.', 'הטענתי את הטלפון, את המחשב ואת הנשמה.'),
  // older travellers
  L('elder', 4, 'Big signs, short walks, kind staff. Thank you, dear.', 'שלטים גדולים, הליכות קצרות, צוות נחמד. תודה, יקירים.'),
  L('elder', 5, 'A young man helped me with my bag. Restored my faith.', 'בחור צעיר עזר לי עם המזוודה. החזיר לי את האמונה.'),
  L('elder', 4, 'Plenty of seats to rest. My knees thank you.', 'הרבה מקומות לשבת. הברכיים שלי מודות לכם.'),
  L('elder', 3, 'Everything is so modern. I miss the old hut a little.', 'הכול כל כך מודרני. קצת מתגעגעת לצריף הישן.'),
  L('elder', 4, 'I have flown since 1960. This is one of the nicer ones.', 'אני טסה מאז 1960. זה אחד הנחמדים.'),
  L('elder', 5, 'They let me board first. Such good manners.', 'נתנו לי לעלות ראשונה. איזה נימוסים.'),
  // VIPs
  L('vip', 5, 'Red carpet, no lines, champagne. As it should be.', 'שטיח אדום, בלי תורים, שמפניה. כמו שצריך.'),
  L('vip', 5, 'The lounge staff knew my name and my drink.', 'הצוות בטרקלין ידע את השם שלי ואת המשקה שלי.'),
  L('vip', 3, 'Acceptable. I have seen better marble.', 'סביר. ראיתי שיש יותר טוב.'),
  L('vip', 4, 'Private car to the plane. Very discreet. Very nice.', 'רכב פרטי עד המטוס. מאוד דיסקרטי. מאוד נחמד.'),
  L('vip', 5, 'My assistant did not have to complain once. Remarkable.', 'העוזר שלי לא היה צריך להתלונן אפילו פעם אחת. מרשים.'),
  L('vip', 3, 'Nice, but the photographers found me anyway.', 'נחמד, אבל הצלמים מצאו אותי בכל זאת.'),
  // weather
  L('weather', 3, 'Fog delayed us, but the staff kept us posted. Fair.', 'הערפל עיכב אותנו, אבל הצוות עדכן אותנו. הוגן.'),
  L('weather', 3, 'Waited out a storm in the lounge. Cosy, actually.', 'חיכינו לסוף הסערה בטרקלין. נעים, בעצם.'),
  L('weather', 4, 'Strong crosswind, perfect landing. Respect to the pilots.', 'רוח צד חזקה, נחיתה מושלמת. כבוד לטייסים.'),
  L('weather', 3, 'Circled for a while because of the wind. Free sightseeing.', 'הסתובבנו באוויר קצת בגלל הרוח. סיור נוף בחינם.'),
  L('weather', 2, 'Weather was bad, mood was worse.', 'מזג האוויר היה רע, מצב הרוח עוד יותר.'),
  L('weather', 4, 'The ILS brought us down through thick fog. Magic.', 'מערכת הנחיתה הורידה אותנו דרך ערפל סמיך. קסם.'),
  // holidays
  L('holiday', 5, 'The terminal was decorated for the holiday. So festive!', 'הטרמינל היה מקושט לחג. כל כך חגיגי!'),
  L('holiday', 4, 'Busy holiday crowds, but it moved well. Happy holidays!', 'המון אנשים בחג, אבל זה זרם טוב. חג שמח!'),
  L('holiday', 5, 'Lights, decorations and a smiling crew. Lovely start to the holiday.', 'אורות, קישוטים וצוות מחייך. התחלה מקסימה לחג.'),
  L('holiday', 4, 'Flew home for the holiday. The airport felt like home already.', 'טסתי הביתה לחג. השדה כבר הרגיש כמו בית.'),
  L('holiday', 5, 'Got a holiday treat at the gate. Sweet touch.', 'קיבלתי ממתק חג ליד השער. נגיעה מתוקה.'),
  L('holiday', 3, 'Holiday rush. Everyone and their grandma was flying.', 'עומס חג. כולם וסבתא שלהם טסו.'),
  // the dirt strip and the hut
  L('dirtStrip', 3, 'A dirt runway and a hut. Charming, in a dusty way.', 'מסלול עפר וצריף. מקסים, בצורה מאובקת.'),
  L('dirtStrip', 4, 'Tiny airfield, big heart.', 'שדה קטנטן, לב גדול.'),
  L('dirtStrip', 3, 'Landed on dirt. Felt like a bush pilot. Loved it.', 'נחתנו על עפר. הרגשתי כמו טייס בוש. אהבתי.'),
  L('dirtStrip', 4, 'Check-in was a man with a clipboard. Very personal.', 'הצ׳ק-אין היה בחור עם לוח. מאוד אישי.'),
  L('dirtStrip', 3, 'The windsock is the whole control tower. Cute.', 'שרוול הרוח הוא כל מגדל הפיקוח. חמוד.'),
  L('dirtStrip', 4, 'No lines at all. There are not enough people for lines.', 'בלי תורים בכלל. אין מספיק אנשים בשביל תורים.'),
  L('dirtStrip', 3, 'My shoes are full of sand but my heart is full of joy.', 'הנעליים שלי מלאות חול אבל הלב שלי מלא שמחה.'),
  L('dirtStrip', 4, 'Watch this little strip grow. I believe in it.', 'תסתכלו איך המסלול הקטן הזה יגדל. אני מאמין בו.'),
  // a big airport
  L('bigAirport', 4, 'Huge airport, yet I never got lost. Great signs.', 'שדה ענק, ובכל זאת לא הלכתי לאיבוד. שלטים מצוינים.'),
  L('bigAirport', 5, 'Terminals, trains, a hotel. It is a city with runways.', 'טרמינלים, רכבות, מלון. זו עיר עם מסלולים.'),
  L('bigAirport', 4, 'I remember when this was a dirt strip. Look at it now!', 'אני זוכר כשזה היה מסלול עפר. תראו אותו עכשיו!'),
  L('bigAirport', 5, 'A world-class hub. Proud to fly from here.', 'האב ברמה עולמית. גאה לטוס מכאן.'),
  L('bigAirport', 4, 'So many gates, so little walking. Clever design.', 'כל כך הרבה שערים, כל כך מעט הליכה. תכנון חכם.'),
  L('bigAirport', 5, 'Watched planes land every minute from the gate. Hypnotic.', 'ראיתי מטוסים נוחתים כל דקה מהשער. מהפנט.'),
  // passport control
  L('passport', 2, 'Passport control took longer than the flight.', 'ביקורת הדרכונים לקחה יותר זמן מהטיסה.'),
  L('passport', 3, 'The officer stared at my photo for a long time. It is an old photo.', 'הפקיד בהה בתמונה שלי הרבה זמן. זו תמונה ישנה.'),
  L('passport', 2, 'More booths, please. The line is a lifestyle.', 'עוד עמדות, בבקשה. התור הוא כבר סגנון חיים.'),
  L('passport', 3, 'Stamp, smile, done. Eventually.', 'חותמת, חיוך, סיימנו. בסוף.'),
  L('passport', 2, 'I practised my "purpose of visit" speech nine times in the line.', 'תרגלתי את נאום "מטרת הביקור" תשע פעמים בתור.'),
  L('passport', 4, 'Passport control was quick for once. Small miracle.', 'ביקורת הדרכונים הייתה מהירה לשם שינוי. נס קטן.'),
  // the baggage claim
  L('carousel', 5, 'My bag was first on the carousel. Never happened before!', 'המזוודה שלי הייתה הראשונה על המסוע. אף פעם לא קרה לי!'),
  L('carousel', 4, 'Bags arrived before I reached the carousel. Fast crew.', 'המזוודות הגיעו לפני שהגעתי למסוע. צוות מהיר.'),
  L('carousel', 5, 'Off the plane, bag in hand, out the door. Ten minutes.', 'מהמטוס, מזוודה ביד, החוצה. עשר דקות.'),
  L('carousel', 4, 'The carousel even has colours. Very cheerful.', 'למסוע יש אפילו צבעים. מאוד עליז.'),
  L('carousel', 3, 'Waited a bit for the bags, but they all came. All of them!', 'חיכינו קצת למזוודות, אבל כולן הגיעו. כולן!'),
  L('carousel', 5, 'The baggage team is faster than my food delivery.', 'צוות המטען מהיר יותר מהמשלוחים שלי.'),
];

/** Lines of each topic (indices into REVIEWS). */
export const REVIEWS_BY_TOPIC: Readonly<Record<ReviewTopic, readonly number[]>> = (() => {
  const out = {} as Record<ReviewTopic, number[]>;
  REVIEWS.forEach((r, i) => {
    (out[r.topic] ??= []).push(i);
  });
  return out;
})();
