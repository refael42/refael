# הישגים: מזהים ל-Game Center ול-Google Play Games

במשחק יש 16 הישגים, ולכל אחד מדליות ארד, כסף וזהב (src/data/achievements.ts). כשמחברים את Game Center (אפל) ואת Play Games (גוגל), יוצרים בכל קונסולה הישג לכל מדליה עם המזהה שבטבלה. השם והתיאור שם יהיו כמו במשחק.

| הישג | ארד | כסף | זהב |
|---|---|---|---|
| served (100 / 2000 / 25000) | ach_served_bronze | ach_served_silver | ach_served_gold |
| fiveStars (50 / 1000 / 10000) | ach_fiveStars_bronze | ach_fiveStars_silver | ach_fiveStars_gold |
| earned (10^6 / 10^12 / 10^18) | ach_earned_bronze | ach_earned_silver | ach_earned_gold |
| combo (5 / 8 / 10) | ach_combo_bronze | ach_combo_silver | ach_combo_gold |
| hires (5 / 30 / 150) | ach_hires_bronze | ach_hires_silver | ach_hires_gold |
| building (1 / 3 / 6) | ach_building_bronze | ach_building_silver | ach_building_gold |
| chef (10 / 25 / 50) | ach_chef_bronze | ach_chef_silver | ach_chef_gold |
| album (6 / 12 / 18) | ach_album_bronze | ach_album_silver | ach_album_gold |
| vip (5 / 50 / 300) | ach_vip_bronze | ach_vip_silver | ach_vip_gold |
| delivered (20 / 300 / 3000) | ach_delivered_bronze | ach_delivered_silver | ach_delivered_gold |
| occasions (1 / 10 / 50) | ach_occasions_bronze | ach_occasions_silver | ach_occasions_gold |
| inspector (1 / 5 / 20) | ach_inspector_bronze | ach_inspector_silver | ach_inspector_gold |
| guide (1 / 2 / 3) | ach_guide_bronze | ach_guide_silver | ach_guide_gold |
| trophies (1 / 3 / 6) | ach_trophies_bronze | ach_trophies_silver | ach_trophies_gold |
| holidays (1 / 5 / 10) | ach_holidays_bronze | ach_holidays_silver | ach_holidays_gold |
| branches (1 / 3 / 6) | ach_branches_bronze | ach_branches_silver | ach_branches_gold |

באפל מגדירים את זה ב-App Store Connect, בעמוד של האפליקציה, תחת Game Center ואז Achievements. בגוגל זה ב-Play Console, תחת Play Games Services ואז Achievements. החיבור עצמו לשירותים צריך חבילה עם בנייה נייטיב, ולכן הוא עוד לא במשחק.
