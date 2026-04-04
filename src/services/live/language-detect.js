/**
 * Language Detection — Detect language of text using trigram analysis
 * No API needed. Runs locally.
 */

// Common trigrams for top languages
const PROFILES = {
  en: "the and ing tion her hat his ent ere ion ter est for tha rea hat all ith",
  es: "ión que los las por con una del est ent ado nte cia ero ara mos ien ica",
  fr: "les des ent que ion par ait ous est sur une eur ant our ais ait ire ons",
  de: "ein sch und der ich die den ung ber eit ach cht ste ver ier ges ter hen",
  it: "ell che ion ent per con del ato one gli ere lla tti nte anz are ita ost",
  pt: "ção que dos ent por com uma ade mos ido era nte ica ção ais ara ior ado",
  nl: "een het van den oor eer aar ijk sch ing ijd aan ter ond ver aat dat nde",
  ru: "ост ени про что ать ста ных ого ком ред ных пер ель ной ние ого кот",
  zh: "的是 不了 我们 他的 这个 在一 有人 来到 就是 也不 大家 出来 没有 什么 自己",
  ja: "ので する から ない した って もの ある この ます です こと した それ でも",
  ko: "이다 하는 에서 으로 있는 한다 하고 에는 것은 이라 적인 하여 들은 이는",
  ar: "الم من في أن على إلى وال الع هذا كان لأن الت",
};

function getTrigrams(text) {
  const clean = text.toLowerCase().replace(/[0-9\n\r]/g, '');
  const trigrams = {};
  for (let i = 0; i < clean.length - 2; i++) {
    const tri = clean.slice(i, i + 3);
    trigrams[tri] = (trigrams[tri] || 0) + 1;
  }
  return trigrams;
}

function score(textTrigrams, profileStr) {
  const profileTrigrams = profileStr.split(' ');
  let matches = 0;
  for (const tri of profileTrigrams) {
    if (textTrigrams[tri]) matches += textTrigrams[tri];
  }
  return matches;
}

const LANGUAGE_NAMES = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", nl: "Dutch", ru: "Russian",
  zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
};

export function detectLanguage(text) {
  if (!text || text.length < 10) {
    return { error: "Text too short (minimum 10 characters)", provider: "HiveAgent LanguageDetect" };
  }

  const trigrams = getTrigrams(text);
  const scores = {};

  for (const [lang, profile] of Object.entries(PROFILES)) {
    scores[lang] = score(trigrams, profile);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0][1] || 1;

  const results = sorted.slice(0, 3).map(([lang, s]) => ({
    language: lang,
    name: LANGUAGE_NAMES[lang] || lang,
    confidence: Math.round((s / topScore) * 100) / 100,
  }));

  return {
    detected: results[0],
    alternatives: results.slice(1),
    text_length: text.length,
    provider: "HiveAgent LanguageDetect",
  };
}
