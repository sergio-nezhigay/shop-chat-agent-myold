/**
 * Reply-language detection
 * Picks the customer's language in code so the model gets an explicit target
 * instead of guessing from a Ukrainian-heavy prompt and catalog data.
 */

export const LANGUAGE_NAMES = { uk: "Ukrainian", ru: "Russian", en: "English" };

// Markdown links, URLs/paths, SKUs and the product title in the product-page prefill
// («Подойдёт ли <title> (арт. 123)?» / «Чи підійде <title> (арт. 123)?») carry
// catalog wording, not the customer's language.
function stripCatalogText(text) {
  return text
    // Sent by the widget's add-to-cart button, always in English (chat.js).
    .replace(/^Add .* to my cart$/s, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\S*\/\S*/g, " ")
    .replace(/(Подойдёт ли|Подойдет ли|Чи підійде)\s.*?(\(арт\.[^)]*\))?\?/gi, "$1 ?")
    .replace(/\(арт\.[^)]*\)/gi, " ");
}

/**
 * Classifies one piece of text.
 * @param {string} text - Customer text with catalog wording already stripped
 * @returns {'uk'|'ru'|'en'|null} null when the text gives no clear signal
 *   (digits only, model names, "ok", "8gb", Cyrillic without unique letters/words)
 */
export function classifyText(text) {
  const lower = ` ${text.toLowerCase()} `;
  const cyrillic = (lower.match(/[а-яёіїєґ]/g) || []).length;
  const latin = (lower.match(/[a-z]/g) || []).length;
  // Latin alone isn't enough: bare model names ("VivoBook 15") stay ambiguous.
  if (!cyrillic) {
    const enWords = (lower.match(/[a-z']+/g) || []).filter((w) => EN_WORDS.has(w));
    return latin && enWords.length ? "en" : null;
  }

  // Each telltale letter counts 1 and each known word 2: words weigh more, since customers often
  // type Russian on a Ukrainian layout ("процесор") or mix in one stray letter.
  const words = lower.match(/[а-яёіїєґ']+/g) || [];
  const score = (letters, vocab) =>
    (lower.match(letters) || []).length + 2 * words.filter((w) => vocab.has(w)).length;
  const ru = score(/[ыэъё]/g, RU_WORDS);
  const uk = score(/[іїєґ]/g, UK_WORDS);

  if (ru > uk) return "ru";
  if (uk > ru) return "uk";
  return null;
}

const EN_WORDS = new Set([
  "i", "you", "we", "the", "a", "an", "is", "are", "do", "does", "can", "could",
  "need", "want", "have", "has", "please", "hi", "hello", "thanks", "what", "how",
  "which", "where", "when", "my", "your", "it", "this", "will", "fit", "sell",
  "buy", "order", "return", "price", "for", "with", "and", "to", "of", "not", "yes", "no",
]);
const RU_WORDS = new Set([
  "что", "как", "это", "нужно", "надо", "есть", "или", "если", "можно", "какой",
  "какая", "какие", "подойдёт", "подойдет", "подходит", "здравствуйте", "спасибо",
  "сколько", "где", "когда", "мне", "нет", "да", "ли", "будет", "только",
  "ещё", "еще", "две", "планки", "заказать", "заказ", "новой", "почте", "привет",
  "подскажи", "подскажите", "вчера", "сделал", "найди", "товары", "почему", "лучший",
  "который", "время", "сейчас", "спасибо", "пожалуйста", "работает",
]);
const UK_WORDS = new Set([
  "що", "як", "це", "потрібно", "треба", "є", "або", "якщо", "можна", "який",
  "яка", "які", "підійде", "підходить", "вітаю", "дякую", "скільки", "де", "коли",
  "мені", "ні", "чи", "буде", "тільки", "ще", "дві", "замовити",
  "новій", "пошті", "добрий", "привіт", "підкажіть", "підкажи", "вчора", "зробив",
  "замовлення", "знайди", "товари", "чому", "найкращий", "зараз", "будь", "ласка", "працює",
]);

/** Plain text of a Messages-API content value (string or block array). */
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((b) => b?.type === "text").map((b) => b.text).join(" ");
}

/**
 * Language for the next reply: the newest customer message with a clear
 * signal wins; ambiguous messages keep the conversation's language; Ukrainian
 * only when nothing in the conversation is clear.
 * @param {Array} history - Messages-API history (tool_result user rows are skipped)
 * @returns {'uk'|'ru'|'en'}
 */
export function detectReplyLanguage(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "user") continue;
    const lang = classifyText(stripCatalogText(textOf(msg.content)));
    if (lang) return lang;
  }
  return "uk";
}

/** Language of a bot reply, for the mismatch log. */
export function detectTextLanguage(content) {
  return classifyText(stripCatalogText(textOf(content)));
}

/** Short per-turn instruction appended after the cached system prompt. */
export function languageInstruction(lang) {
  const name = LANGUAGE_NAMES[lang];
  return `Reply language for this turn: ${name}. Write every sentence in ${name}, ` +
    `including the fixed closing lines and caveats (use their ${name} version). ` +
    `Keep product names, prices and [links](url) exactly as given.`;
}
