export const sourceIcons = {
  Trustpilot: "TP",
  "Google Play Reviews": "GP",
  "Apple App Store Reviews": "AS",
  "Google Reviews": "GR",
  Reddit: "RD",
  "Survey CSV": "CSV",
  "Google Play": "GP",
  "Apple App Store": "AS"
};

export function parseRating(value) {
  const match = String(value).match(/[0-9.]+/);
  return match ? Number(match[0]) : null;
}

export function parseReviewCount(value) {
  const numeric = String(value).replace(/[^0-9]/g, "");
  return numeric ? Number(numeric) : null;
}

export function numbered(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function detectInputLanguage(message) {
  const text = message.toLowerCase();
  if (/[\u4e00-\u9fff]/.test(message)) return "Chinese";
  if (/[\u3040-\u30ff]/.test(message)) return "Japanese";
  if (/[\uac00-\ud7af]/.test(message)) return "Korean";
  if (/[¿¡ñáéíóúü]/i.test(message) || /\b(quiero|ver|que|qué|por|para|competidor|ruta|reseña|informe|cliente|recomendación)\b/.test(text)) return "Spanish";
  if (/[àâçéèêëîïôûùüÿœ]/i.test(message) || /\b(je|veux|voir|avis|pourquoi|rapport|client|concurrent|itinéraire|recommandation)\b/.test(text)) return "French";
  if (/[äöüß]/i.test(message) || /\b(warum|welche|braucht|bewertung|bewertungen|empfehlung|wettbewerber|kommunikation|kunden|routen)\b/.test(text)) return "German";
  if (/[æøå]/i.test(message) || /\b(jeg|vil|gerne|se|hvad|hvordan|hvorfor|rute|rapport|anbefaling|konkurrent|anmeldelse|kunde|færge|faerge)\b/.test(text)) return "Danish";
  return "English";
}

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

export function tokenizeQuery(message) {
  const text = normalizeSearchText(message);
  const tokens = text.split(/\s+/).filter((token) => token.length > 2);
  const synonyms = {
    app: ["app", "mobile", "login", "booking", "android", "apple", "ios", "google", "play"],
    competitor: ["competitor", "competitors", "benchmark", "compare", "comparison", "overlap"],
    route: ["route", "dover", "calais", "newhaven", "dieppe", "newcastle", "ijmuiden", "jersey"],
    recommendation: ["recommend", "recommendation", "action", "next", "priority", "marketing"],
    rootCause: ["why", "root", "cause", "reason", "problem", "risk"],
    source: ["source", "evidence", "data", "review", "reviews", "trustpilot", "reddit"]
  };

  Object.values(synonyms).forEach((words) => {
    if (words.some((word) => text.includes(word))) {
      tokens.push(...words);
    }
  });

  if (/[\u4e00-\u9fff]/.test(message)) {
    if (message.includes("app") || message.includes("应用") || message.includes("登录") || message.includes("评分")) tokens.push(...synonyms.app);
    if (message.includes("竞品") || message.includes("竞争") || message.includes("对比")) tokens.push(...synonyms.competitor);
    if (message.includes("航线") || message.includes("路线")) tokens.push(...synonyms.route);
    if (message.includes("推荐") || message.includes("建议") || message.includes("下一步")) tokens.push(...synonyms.recommendation);
    if (message.includes("为什么") || message.includes("原因") || message.includes("根因") || message.includes("风险")) tokens.push(...synonyms.rootCause);
    if (message.includes("证据") || message.includes("来源") || message.includes("数据")) tokens.push(...synonyms.source);
  }

  return [...new Set(tokens)];
}
