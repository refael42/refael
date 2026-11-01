// First names for applicants, written in every script the game shows so a person keeps their
// name when the player switches language (Spanish uses the Latin spelling).

export interface PersonName {
  he: string;
  en: string;
  ar: string;
  ru: string;
}

const n = (he: string, en: string, ar: string, ru: string): PersonName => ({ he, en, ar, ru });

export const NAMES: readonly PersonName[] = [
  n('נועה', 'Noa', 'نوعا', 'Ноа'), n('יובל', 'Yuval', 'يوفال', 'Юваль'), n('עומר', 'Omer', 'عومر', 'Омер'), n('שירה', 'Shira', 'شيرا', 'Шира'),
  n('איתי', 'Itai', 'إيتاي', 'Итай'), n('מאיה', 'Maya', 'مايا', 'Майя'), n('ליאור', 'Lior', 'ليؤور', 'Лиор'), n('טל', 'Tal', 'طال', 'Таль'),
  n('רוני', 'Roni', 'روني', 'Рони'), n('דנה', 'Dana', 'دانا', 'Дана'), n('גל', 'Gal', 'غال', 'Гал'), n('עמית', 'Amit', 'عميت', 'Амит'),
  n('עדי', 'Adi', 'عدي', 'Ади'), n('אורי', 'Ori', 'أوري', 'Ори'), n('שי', 'Shai', 'شاي', 'Шай'), n('נועם', 'Noam', 'نوعام', 'Ноам'),
  n('יעל', 'Yael', 'ياعيل', 'Яэль'), n('עדן', 'Eden', 'عيدن', 'Эден'), n('עידו', 'Ido', 'عيدو', 'Идо'), n('ליה', 'Lia', 'ليا', 'Лия'),
  n('רון', 'Ron', 'رون', 'Рон'), n('הילה', 'Hila', 'هيلا', 'Хила'), n('תום', 'Tom', 'توم', 'Том'), n('אביב', 'Aviv', 'أفيف', 'Авив'),
  n('ענבר', 'Inbar', 'عنبر', 'Инбар'), n('זיו', 'Ziv', 'زيف', 'Зив'), n('תמר', 'Tamar', 'تمار', 'Тамар'), n('יונתן', 'Yonatan', 'يوناتان', 'Йонатан'),
  n('מיכל', 'Michal', 'ميخال', 'Михаль'), n('דניאל', 'Daniel', 'دانيال', 'Даниэль'), n('אלה', 'Ella', 'إيلا', 'Элла'), n('בן', 'Ben', 'بن', 'Бен'),
  n('סהר', 'Sahar', 'سهر', 'Сахар'), n('אגם', 'Agam', 'أغام', 'Агам'), n('רז', 'Raz', 'راز', 'Раз'), n('אופיר', 'Ofir', 'أوفير', 'Офир'),
  n('סתיו', 'Stav', 'ستاف', 'Став'), n('הדר', 'Hadar', 'هدار', 'Хадар'), n('ים', 'Yam', 'يام', 'Ям'), n('אליה', 'Elia', 'إيليا', 'Элия'),
];

/** A name in the player's language; Spanish (and anything else in Latin script) uses the English spelling. */
export function nameIn(name: PersonName, lang: string): string {
  return lang === 'he' || lang === 'ar' || lang === 'ru' ? name[lang] : name.en;
}
