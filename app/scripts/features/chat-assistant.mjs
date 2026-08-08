import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";
import { getActiveView, getSelectedRoute } from "../core/state.mjs";
import { buildDashboardContext } from "../services/dashboard-context.mjs";
import { getLiveChatResponse as requestLiveChatResponse } from "../services/chat-api.mjs";
import { retrieveLocalEvidence } from "../services/local-knowledge-base.mjs";
import { detectInputLanguage, escapeHtml } from "../utils/format.mjs";

const chatMessages = [
  {
    role: "assistant",
    text: "Hi, I’m MIA. I can turn this report’s evidence into a quick read on app risk, route priorities, passenger profile, data flow, memory, and next actions."
  }
];

const suggestedQuestions = [
  {
    label: "App risk",
    question: "What is the biggest app-related customer risk, and what should DFDS fix first?"
  },
  {
    label: "Route priority",
    question: "Which route needs the most careful customer communication right now, and why?"
  },
  {
    label: "IT Data Flow",
    question: "How does the upload-to-Mia data flow work, and where should version control and reliability checks sit?"
  },
  {
    label: "Memory",
    question: "How should short-term, medium-term, and long-term memory work across the whole DFDS platform?"
  },
  {
    label: "Dover-Calais",
    question: "What does the evidence say about Dover-Calais delay guidance and ticket-rule clarity?"
  },
  {
    label: "Competitors",
    question: "What can DFDS learn from the competitor benchmark without overclaiming?"
  },
  {
    label: "Next actions",
    question: "Give me the top three recommendations for Marketing and CX, with evidence IDs."
  }
];

const chineseEvidenceTitles = {
  "Terminal and boarding proof points": "码头与登船体验证明点",
  "DFDS": "DFDS 品牌基准",
  "Use Google location strengths as route-level proof points": "把 Google 地点评价优势转成航线级营销证据",
  "App and booking friction": "App 与预订流程摩擦",
  "Disruption communication": "延误与突发情况沟通",
  "Staff and onboard service strength": "员工与船上服务优势",
  "Channel Islands trust risk": "海峡群岛服务信任风险",
  "Ticket rules and alternative choices": "票务规则与替代出行选择",
  "Overall brand perception is strong but uneven": "整体品牌感知较强但不均衡",
  "Staff and service are brand strengths": "员工与服务是品牌优势",
  "Boarding, cabins, and food are friction points": "登船、客舱与餐饮是摩擦点",
  "Terminal experience is a marketing proof point": "码头体验可以作为营销证据",
  "Crossing experience is stronger than terminal impression": "航行体验强于码头印象",
  "Mini-cruise and onboard service are strong positives": "迷你邮轮与船上服务是明显正向信号",
  "Passenger app login and booking access are visible pain points": "乘客 App 登录与预订访问是可见痛点",
  "Mobile check-in expectation mismatch": "移动值机期待与实际能力不匹配",
  "Android app perception is weaker than brand perception": "Android App 感知弱于整体品牌感知",
  "IT Data Flow": "IT 数据流",
  "Platform memory architecture": "平台记忆架构",
  "Short-term memory": "短期记忆",
  "Medium-term memory": "中期记忆",
  "Long-term memory": "长期记忆",
  "Build a disruption recovery message system for delay-heavy routes": "为高延误风险航线建立 disruption recovery 信息机制",
  "Fix DFDS Passenger app authentication and booking retrieval before promoting mobile self-service": "推广移动自助前先修复 App 登录与预订找回问题",
  "Add route-level mobile feature messaging": "增加航线级移动功能说明"
};

const chineseEvidenceTypes = {
  "Source coverage": "数据覆盖",
  "App store": "应用商店",
  "App review evidence": "App 评论证据",
  "Google location review": "Google 地点评价",
  "IT data flow": "IT 数据流",
  "IT flow version": "IT 流程版本",
  "Memory architecture": "记忆架构",
  "Memory layer": "记忆层",
  "Customer signal": "客户信号",
  "Customer voice theme": "客户声音主题",
  "Root cause": "根因分析",
  "Competitor benchmark": "竞品基准",
  "Recommendation": "建议",
  "Source link": "来源链接"
};

function formatChineseScore(scoreText = "") {
  return String(scoreText)
    .replaceAll("reviews", "条评论")
    .replaceAll("confidence", "置信度")
    .replaceAll("impact", "影响");
}

function formatChineseEvidenceItem(item) {
  const title = chineseEvidenceTitles[item.title] || chineseEvidenceTypes[item.type] || item.title;
  const score = item.scoreText ? `（${formatChineseScore(item.scoreText)}）` : "";

  if (item.title === "Terminal and boarding proof points") {
    return `${title} — Google 地点评价显示，码头服务、登船流程、员工服务和航行体验是可用于 Dover-Calais 等航线营销的正向证据。Calais 为 4.2/5（2,331 条 Google 评论），Dover 为 4.3/5（47 条 Google 评论），Newhaven 为 4.2/5（478 条 Google 评论），Newcastle 为 4.4/5（346 条 Google 评论）。`;
  }

  if (item.title === "DFDS") {
    return `${title} — DFDS 当前可见品牌基准为 4.2/5，来自 20,646 条评论。整体品牌评价基础较强，但 disruption recovery、延误沟通和出行前数字体验仍是需要保护信任的摩擦点。`;
  }

  if (item.title === "Use Google location strengths as route-level proof points") {
    return `${title} — 中优先级建议。不同航线的 Google 地点评价优势不同：Dover-Calais 更适合强调码头效率和员工服务，Newhaven-Dieppe 可强调值机与航行体验，Newcastle-IJmuiden 可强调船上体验。这样 campaign claim 会更贴近公开评论证据。`;
  }

  if (item.type === "Google location review") {
    return `${title} — 这是 ${item.route || "当前航线"} 的 Google 地点评价信号，可用于判断码头、员工服务、登船流程或航行体验是否能支撑营销表达${score}。`;
  }

  if (item.type === "Competitor benchmark") {
    return `${title} — 这是竞品/品牌基准证据，用来判断 DFDS 与相关 ferry operator 在评分、评论规模、航线重叠和客户感知上的差异${score}。`;
  }

  if (item.type === "Recommendation") {
    return `${title} — 这是行动建议证据，重点说明优先级、预期改善和背后的公开客户信号${score}。`;
  }

  if (item.type === "IT data flow" || item.type === "IT flow version") {
    return `${title} — 这是 IT 端数据流与版本管理证据，用来判断上传、清洗、建模、发布和 Mia 读取之间是否连贯${score}。`;
  }

  if (item.type === "Memory architecture" || item.type === "Memory layer") {
    return `${title} — 这是平台记忆架构证据，用来说明短期、中期和长期记忆该存放什么、谁可以复用、什么时候该衰减${score}。`;
  }

  if (item.type.includes("App")) {
    return `${title} — 这是 App 体验证据，主要用于判断登录、预订找回、移动值机或路线功能说明是否影响出行前信任${score}。`;
  }

  if (item.type.includes("Customer")) {
    return `${title} — 这是客户声音证据，主要用于判断公开评论中反复出现的体验主题，以及它对 marketing、CX 或航线沟通的影响${score}。`;
  }

  return `${title} — 这是来自 ${item.source || "dashboard"} 的证据摘要，用于支持当前 DFDS 报告判断${score}。`;
}

const localizedEvidence = {
  Danish: {
    empty: "Der blev ikke fundet matchende evidens i det lokale frontend-datasæt.",
    titles: {
      "Terminal and boarding proof points": "Dokumentation for terminal- og boardingoplevelsen",
      "DFDS": "DFDS-brandbaseline",
      "Use Google location strengths as route-level proof points": "Brug styrker fra Google-lokationer som rutespecifik dokumentation"
    },
    terminal: "Google-lokationsanmeldelser viser, at terminalservice, boardingflow, personale og overfartsoplevelse kan bruges som positive proof points for ruter som Dover-Calais. Calais ligger på 4,2/5 fra 2.331 Google-anmeldelser, og Dover ligger på 4,3/5 fra 47 Google-anmeldelser.",
    dfds: "DFDS har en synlig brandbaseline på 4,2/5 fra 20.646 anmeldelser. Den samlede brandbase er stærk, men disruption recovery, forsinkelseskommunikation og den digitale før-rejseoplevelse er stadig tillidsrisici.",
    googleProof: "Anbefaling med middel prioritet. Google-lokationsanmeldelser viser forskellige styrker pr. rute: Dover-Calais kan fremhæve terminaleffektivitet og personale, Newhaven-Dieppe kan fremhæve check-in og overfart, og Newcastle-IJmuiden kan fremhæve oplevelsen om bord.",
    googleLocation: "Dette er et Google-lokationssignal for den aktuelle rute og kan bruges til at vurdere, om terminal, personale, boarding eller overfart kan understøtte marketingbudskaber.",
    competitor: "Dette er benchmark-evidens for brand eller konkurrenter og bruges til at vurdere score, anmeldelsesvolumen, ruteoverlap og kundernes opfattelse.",
    recommendation: "Dette er anbefalingsevidens, som samler prioritet, forventet forbedring og de offentlige kundesignaler bag forslaget.",
    app: "Dette er app-evidens og bruges til at vurdere, om login, bookinghentning, mobil check-in eller rutefunktioner påvirker tilliden før rejsen.",
    customer: "Dette er customer-voice-evidens og bruges til at vurdere gentagne oplevelsestemaer i offentlige anmeldelser og deres betydning for marketing, CX eller rutekommunikation.",
    fallback: "Dette er et evidensresumé fra det aktuelle dashboard, som understøtter vurderingen i DFDS-rapporten."
  },
  Spanish: {
    empty: "No se encontró evidencia coincidente en el conjunto de datos local del frontend.",
    titles: {
      "Terminal and boarding proof points": "Pruebas sobre terminal y embarque",
      "DFDS": "Referencia de marca de DFDS",
      "Use Google location strengths as route-level proof points": "Usar fortalezas de Google por ubicación como pruebas por ruta"
    },
    terminal: "Las reseñas de Google por ubicación muestran que el servicio en terminal, el flujo de embarque, el personal y la experiencia de cruce pueden apoyar mensajes de marketing en rutas como Dover-Calais.",
    dfds: "DFDS tiene una referencia visible de 4,2/5 basada en 20.646 reseñas. La base de marca es fuerte, pero la recuperación ante incidencias, la comunicación de retrasos y la experiencia digital previa al viaje siguen siendo riesgos de confianza.",
    googleProof: "Recomendación de prioridad media. Las reseñas de Google por ubicación muestran fortalezas distintas por ruta: Dover-Calais puede destacar eficiencia de terminal y personal, Newhaven-Dieppe el check-in y el cruce, y Newcastle-IJmuiden la experiencia a bordo.",
    googleLocation: "Esta es una señal de Google Reviews para la ruta actual y ayuda a evaluar si terminal, personal, embarque o cruce pueden respaldar mensajes de marketing.",
    competitor: "Esta es evidencia de benchmark de marca o competidor para comparar puntuación, volumen de reseñas, solapamiento de rutas y percepción del cliente.",
    recommendation: "Esta es evidencia de recomendación, con prioridad, mejora esperada y señales públicas de clientes.",
    app: "Esta es evidencia de experiencia de app y ayuda a evaluar si login, recuperación de reserva, check-in móvil o funciones por ruta afectan la confianza previa al viaje.",
    customer: "Esta es evidencia de voz del cliente sobre temas recurrentes en reseñas públicas y su impacto en marketing, CX o comunicación de ruta.",
    fallback: "Este es un resumen de evidencia del dashboard actual para apoyar el análisis del informe DFDS."
  },
  French: {
    empty: "Aucune preuve correspondante n’a été trouvée dans le jeu de données local du frontend.",
    titles: {
      "Terminal and boarding proof points": "Preuves sur le terminal et l’embarquement",
      "DFDS": "Référence de marque DFDS",
      "Use Google location strengths as route-level proof points": "Utiliser les points forts Google par lieu comme preuves par route"
    },
    terminal: "Les avis Google par lieu montrent que le service au terminal, le flux d’embarquement, le personnel et l’expérience de traversée peuvent soutenir les messages marketing sur des routes comme Dover-Calais.",
    dfds: "DFDS affiche une référence visible de 4,2/5 à partir de 20 646 avis. La base de marque est solide, mais la gestion des perturbations, la communication sur les retards et l’expérience digitale avant voyage restent des risques de confiance.",
    googleProof: "Recommandation de priorité moyenne. Les avis Google par lieu montrent des forces différentes selon les routes : Dover-Calais peut mettre en avant l’efficacité du terminal et le personnel, Newhaven-Dieppe le check-in et la traversée, et Newcastle-IJmuiden l’expérience à bord.",
    googleLocation: "Il s’agit d’un signal Google Reviews pour la route actuelle, utile pour juger si le terminal, le personnel, l’embarquement ou la traversée peuvent soutenir les messages marketing.",
    competitor: "Il s’agit d’une preuve de benchmark marque ou concurrent, utile pour comparer score, volume d’avis, chevauchement de routes et perception client.",
    recommendation: "Il s’agit d’une preuve liée à une recommandation, avec priorité, amélioration attendue et signaux clients publics.",
    app: "Il s’agit d’une preuve sur l’expérience app, utile pour évaluer l’impact du login, de la récupération de réservation, du check-in mobile ou des fonctionnalités par route.",
    customer: "Il s’agit d’une preuve customer voice, utile pour comprendre les thèmes récurrents dans les avis publics et leur impact marketing, CX ou route.",
    fallback: "Il s’agit d’un résumé de preuve issu du dashboard actuel pour soutenir l’analyse du rapport DFDS."
  },
  German: {
    empty: "Im lokalen Frontend-Datensatz wurden keine passenden Belege gefunden.",
    titles: {
      "Terminal and boarding proof points": "Belege für Terminal- und Boarding-Erlebnis",
      "DFDS": "DFDS-Markenbaseline",
      "Use Google location strengths as route-level proof points": "Google-Standortstärken als rutenbezogene Belege nutzen"
    },
    terminal: "Google-Standortbewertungen zeigen, dass Terminalservice, Boarding-Ablauf, Mitarbeitende und Überfahrtserlebnis als positive Proof Points für Routen wie Dover-Calais nutzbar sind.",
    dfds: "DFDS hat eine sichtbare Markenbaseline von 4,2/5 aus 20.646 Bewertungen. Die Markenbasis ist stark, aber Störungsbehebung, Verspätungskommunikation und digitale Vorreise-Erfahrung bleiben Vertrauensrisiken.",
    googleProof: "Empfehlung mit mittlerer Priorität. Google-Standortbewertungen zeigen je Route unterschiedliche Stärken: Dover-Calais eignet sich für Terminaleffizienz und Mitarbeitende, Newhaven-Dieppe für Check-in und Überfahrt, Newcastle-IJmuiden für das Erlebnis an Bord.",
    googleLocation: "Dies ist ein Google-Standortsignal für die aktuelle Route und hilft zu bewerten, ob Terminal, Mitarbeitende, Boarding oder Überfahrt Marketingaussagen stützen können.",
    competitor: "Dies ist Benchmark-Evidenz für Marke oder Wettbewerber und hilft beim Vergleich von Score, Bewertungsvolumen, Routenüberschneidung und Kundenwahrnehmung.",
    recommendation: "Dies ist Empfehlungsevidenz mit Priorität, erwarteter Verbesserung und den öffentlichen Kundensignalen dahinter.",
    app: "Dies ist App-Evidenz und hilft zu bewerten, ob Login, Buchungsabruf, Mobile Check-in oder Routenfunktionen das Vertrauen vor der Reise beeinflussen.",
    customer: "Dies ist Customer-Voice-Evidenz zu wiederkehrenden Themen in öffentlichen Bewertungen und deren Bedeutung für Marketing, CX oder Routenkommunikation.",
    fallback: "Dies ist eine Evidenz-Zusammenfassung aus dem aktuellen Dashboard zur Unterstützung der DFDS-Analyse."
  },
  Japanese: {
    empty: "現在のフロントエンドデータセットに一致するエビデンスは見つかりませんでした。",
    titles: {
      "Terminal and boarding proof points": "ターミナルと乗船体験の根拠",
      "DFDS": "DFDSブランド基準",
      "Use Google location strengths as route-level proof points": "Googleロケーションの強みをルート別の根拠として使う"
    },
    terminal: "Googleロケーションレビューでは、ターミナルサービス、乗船の流れ、スタッフ対応、航行体験が Dover-Calais などのルートでマーケティング上の根拠になり得ることが示されています。",
    dfds: "DFDSの可視的なブランド基準は20,646件のレビューに基づく4.2/5です。全体のブランド基盤は強い一方、遅延時の回復対応、混乱時の情報提供、旅行前のデジタル体験は信頼リスクです。",
    googleProof: "中優先度の推奨です。Googleロケーションレビューでは、Dover-Calais はターミナル効率とスタッフ、Newhaven-Dieppe はチェックインと航行体験、Newcastle-IJmuiden は船内体験を強調できます。",
    googleLocation: "これは現在のルートに関する Google Reviews のシグナルで、ターミナル、スタッフ、乗船、航行体験がマーケティング表現を支えられるかを判断する材料です。",
    competitor: "これはブランドまたは競合のベンチマーク根拠で、スコア、レビュー量、ルート重複、顧客認識の比較に使います。",
    recommendation: "これは推奨事項の根拠で、優先度、期待される改善、公開顧客シグナルをまとめています。",
    app: "これはアプリ体験の根拠で、ログイン、予約確認、モバイルチェックイン、ルート別機能が旅行前の信頼に与える影響を判断します。",
    customer: "これは顧客の声の根拠で、公開レビューに繰り返し現れる体験テーマと marketing、CX、ルートコミュニケーションへの影響を示します。",
    fallback: "これは現在のダッシュボードからのエビデンス要約で、DFDSレポートの判断を支えます。"
  },
  Korean: {
    empty: "현재 프론트엔드 데이터셋에서 일치하는 근거를 찾지 못했습니다.",
    titles: {
      "Terminal and boarding proof points": "터미널 및 탑승 경험 근거",
      "DFDS": "DFDS 브랜드 기준선",
      "Use Google location strengths as route-level proof points": "Google 위치별 강점을 노선별 근거로 활용"
    },
    terminal: "Google 위치 리뷰는 터미널 서비스, 탑승 흐름, 직원 응대, 항해 경험이 Dover-Calais 같은 노선의 마케팅 근거가 될 수 있음을 보여줍니다.",
    dfds: "DFDS의 가시적인 브랜드 기준선은 20,646개 리뷰 기준 4.2/5입니다. 전체 브랜드 기반은 강하지만 지연 복구, disruption 커뮤니케이션, 여행 전 디지털 경험은 여전히 신뢰 리스크입니다.",
    googleProof: "중간 우선순위 권장사항입니다. Google 위치 리뷰는 노선별 강점이 다름을 보여줍니다. Dover-Calais는 터미널 효율과 직원, Newhaven-Dieppe는 체크인과 항해 경험, Newcastle-IJmuiden는 선상 경험을 강조할 수 있습니다.",
    googleLocation: "이는 현재 노선의 Google Reviews 신호이며 터미널, 직원, 탑승 또는 항해 경험이 마케팅 메시지를 뒷받침할 수 있는지 판단하는 데 사용됩니다.",
    competitor: "이는 브랜드 또는 경쟁사 벤치마크 근거로, 점수, 리뷰 규모, 노선 중복, 고객 인식을 비교하는 데 사용됩니다.",
    recommendation: "이는 권장사항 근거로, 우선순위, 기대 개선 효과, 공개 고객 신호를 함께 보여줍니다.",
    app: "이는 앱 경험 근거로, 로그인, 예약 조회, 모바일 체크인 또는 노선별 기능이 여행 전 신뢰에 미치는 영향을 판단합니다.",
    customer: "이는 고객의 목소리 근거로, 공개 리뷰에서 반복되는 경험 주제와 marketing, CX, 노선 커뮤니케이션에 대한 영향을 보여줍니다.",
    fallback: "이는 현재 dashboard의 근거 요약이며 DFDS 보고서 판단을 뒷받침합니다."
  }
};

function formatLocalizedEvidenceItem(item, language) {
  if (language === "Chinese") return formatChineseEvidenceItem(item);
  const locale = localizedEvidence[language];
  if (!locale) {
    const score = item.scoreText ? ` (${item.scoreText})` : "";
    return `${item.title} — ${item.body}${score}`;
  }

  const title = locale.titles[item.title] || item.title;
  let detail = locale.fallback;
  if (item.title === "Terminal and boarding proof points") detail = locale.terminal;
  else if (item.title === "DFDS") detail = locale.dfds;
  else if (item.title === "Use Google location strengths as route-level proof points") detail = locale.googleProof;
  else if (item.type === "Google location review") detail = locale.googleLocation;
  else if (item.type === "Competitor benchmark") detail = locale.competitor;
  else if (item.type === "Recommendation") detail = locale.recommendation;
  else if (item.type.includes("App")) detail = locale.app;
  else if (item.type.includes("Customer")) detail = locale.customer;

  return `${title} — ${detail}`;
}

function formatEvidenceBullets(evidenceItems, language = "English") {
  if (!evidenceItems.length) {
    return language === "Chinese"
      ? "当前前端数据集中没有找到匹配证据。"
      : localizedEvidence[language]?.empty || "No matching local evidence was found in the current frontend dataset.";
  }

  return evidenceItems
    .slice(0, 3)
    .map((item, index) => {
      return `${index + 1}. ${formatLocalizedEvidenceItem(item, language)}`;
    })
    .join("\n");
}

function shouldShowEvidenceDetails(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return false;
  return /\b(evidence|source|sources|citation|citations|proof|supporting data|supporting evidence|show me why|where is this from|what is this based on)\b/i.test(text)
    || /(证据|佐证|来源|出处|引用|根据|支撑|原文|哪条|哪些数据|数据依据)/.test(text);
}

function getEvidenceSources(evidenceItems) {
  return [...new Set(evidenceItems.map((item) => item.source).filter(Boolean))];
}

function getRouteFromMessage(message) {
  const text = message.toLowerCase();
  if (text.includes("dover") || text.includes("calais")) return "dover-calais";
  if (text.includes("newhaven") || text.includes("dieppe")) return "newhaven-dieppe";
  if (text.includes("newcastle") || text.includes("ijmuiden")) return "newcastle-ijmuiden";
  if (text.includes("jersey") || text.includes("channel islands") || text.includes("海峡群岛")) return "jersey";
  return "";
}

function getEffectiveRoute(message) {
  return getRouteFromMessage(message) || getSelectedRoute();
}

function classifyConversationIntent(message) {
  const text = message.trim().toLowerCase();
  const normalized = text
    .replace(/^(mia|assistant|ai)[,:\s-]+/i, "")
    .replace(/[,:\s-]+(mia|assistant|ai)$/i, "")
    .replace(/[,.!?。！？]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/(weather|temperature|forecast|rain|raining|sunny|snow|wind|windy|storm|天气|气温|下雨|降雨|晴天|刮风|天气怎么样)/i.test(message)) {
    return "liveExternal";
  }

  if (/^(bye|goodbye|see you|see ya|talk soon|farewell|later|good night|gn|再见|拜拜|回头见|晚安|明天见|下次聊)[!.。！\s]*$/i.test(normalized)) {
    return "goodbye";
  }

  if (/^(hi|hello|hey|hiya|morning|good morning|good afternoon|good evening|你好|您好|嗨|早上好|下午好|晚上好)[!.。！\s]*$/i.test(normalized)) {
    return "smallTalk";
  }

  if (/^(who are you|what are you|what can you do|what do you do|who is mia|help|can you help|what is this|what's this|who am i talking to|你是谁|你是什么|你能做什么|你会什么|这是什\u4e48|帮我一下)[?.!。\s]*$/i.test(normalized)) {
    return "capability";
  }

  if (/^(how are you|how are you doing|how's it going|how is it going|are you okay|你好吗|最近怎么样|还好吗)[?.!。\s]*$/i.test(normalized)) {
    return "wellbeing";
  }

  if (/^(thank you|thanks|thx|many thanks|appreciate it|谢谢|謝謝|多谢|多謝|感谢|感謝)[!.。！\s]*$/i.test(normalized)) {
    return "thanks";
  }

  if (/^(ok|okay|k|got it|i got it|i understand|understood|makes sense|sounds good|cool|alright|all right|fine|yes|yep|yeah|sure|thanks|thank you|thx|ok thanks|okay thanks|got it thanks|i got it thanks|ok i got it thanks)(\s+(mia|assistant|ai))?$/i.test(normalized)) {
    return "thanks";
  }

  if (/(好的|好|可以|明白|明白了|懂了|了解|收到|知道了|没问题|谢谢|謝謝|感谢|感謝)/i.test(message)) {
    return "thanks";
  }

  if (/^(sorry|oops|my bad|apologies|pardon|excuse me|抱歉|不好意思|对不起|對不起)[!.。！\s]*$/i.test(normalized)) {
    return "apology";
  }

  if (/^(tell me a joke|joke|make me laugh|say something funny|讲个笑话|说个笑话|來個笑話|來點幽默|說個笑話)[?.!。\s]*$/i.test(normalized)) {
    return "joke";
  }

  if (/^(i don't understand|i do not understand|confused|what do you mean|can you explain|not sure i follow|什么意思|我不太懂|看不懂|你在说什么|你在說什麼)[?.!。\s]*$/i.test(normalized)) {
    return "confusion";
  }

  if (/\b(dfds|report|dashboard|route|routes|dover|calais|newhaven|dieppe|newcastle|ijmuiden|jersey|app|review|reviews|competitor|competitors|recommendation|recommendations|source|sources|evidence|trustpilot|google play|apple|sentiment|customer|marketing|cx|ferry|ferries|航线|路线|报告|仪表盘|竞品|竞争|建议|推荐|证据|来源|评分|评论|客户|渡轮|应用|登录|延误|根因)\b/i.test(message)) {
    return "report";
  }

  return "offTopic";
}

function classifyConversationMode(message) {
  return classifyConversationIntent(message) === "report" ? "vertical" : "smalltalk";
}

function buildBridgeResponse(language, intent = "offTopic") {
  if (intent === "liveExternal") {
    const weatherResponses = {
      Chinese: "我这里不能查看实时天气。不过如果你想评估天气或延误对客户体验的影响，我可以帮你看 DFDS 报告里的 route signals、delay themes 和 customer expectations。你想看 Dover-Calais，还是其他航线？",
      Japanese: "このレポート内ではリアルタイムの天気は確認できません。ただし、天候や遅延が顧客体験にどう影響しているかは、route signals や delay themes から一緒に見られます。どのルートを見ますか？",
      Korean: "이 보고서에서는 실시간 날씨를 확인할 수는 없어요. 대신 날씨나 지연이 고객 경험에 어떤 영향을 주는지는 route signals 와 delay themes 로 함께 볼 수 있습니다. 어떤 노선을 볼까요?",
      Spanish: "No puedo consultar el clima en tiempo real desde este informe. Pero sí puedo ayudarte a ver cómo las rutas, retrasos y expectativas del cliente aparecen en la evidencia de DFDS. ¿Quieres revisar Dover-Calais u otra ruta?",
      French: "Je ne peux pas vérifier la météo en temps réel depuis ce rapport. Mais je peux vous aider à voir comment les routes, les retards et les attentes clients apparaissent dans les preuves DFDS. Voulez-vous regarder Dover-Calais ou une autre route ?",
      German: "Live-Wetter kann ich in diesem Bericht nicht prüfen. Ich kann aber zeigen, wie Routen, Verspätungen und Kundenerwartungen in den DFDS-Signalen auftauchen. Möchtest du Dover-Calais oder eine andere Route ansehen?",
      Danish: "Jeg kan ikke tjekke live-vejret i denne rapport. Men jeg kan hjælpe med at se, hvordan ruter, forsinkelser og kundeforventninger viser sig i DFDS-signalerne. Vil du se Dover-Calais eller en anden rute?"
    };
    return weatherResponses[language] || "I can’t check live weather from this report. But I can help you understand how route experience, delays, and customer expectations show up in the DFDS evidence. Would you like to look at Dover-Calais or another route?";
  }

  if (intent === "goodbye") {
    const responses = {
      Chinese: "再见，我是 Mia。下次你可以直接问我 routes、app reviews、competitors 或 recommendations。",
      Japanese: "またね、Miaです。次は routes、app reviews、competitors、recommendations をそのまま聞いてください。",
      Korean: "안녕히 가세요, Mia입니다. 다음에는 routes, app reviews, competitors, recommendations를 바로 물어보세요.",
      Spanish: "Hasta luego, soy Mia. La próxima vez puedes preguntarme por routes, app reviews, competitors o recommendations.",
      French: "À bientôt, je suis Mia. La prochaine fois, demandez-moi directement les routes, app reviews, competitors ou recommendations.",
      German: "Bis dann, ich bin Mia. Frag mich beim nächsten Mal direkt nach routes, app reviews, competitors oder recommendations.",
      Danish: "Farvel, jeg er Mia. Næste gang kan du bare spørge mig om routes, app reviews, competitors eller recommendations."
    };
    return responses[language] || "Goodbye, I’m Mia. Next time you can ask me about routes, app reviews, competitors, or recommendations.";
  }

  if (intent === "capability") {
    const responses = {
      Chinese: "我是 Mia，DFDS Customer Intelligence 里的报告助手。我可以帮你看 routes、app reviews、competitors、recommendations，还有证据和更新日志。",
      Japanese: "私は Mia です。DFDS Customer Intelligence のレポートアシスタントです。routes、app reviews、competitors、recommendations、証拠、更新ログをお手伝いできます。",
      Korean: "저는 Mia예요. DFDS Customer Intelligence의 보고서 도우미입니다. routes, app reviews, competitors, recommendations, 근거, 업데이트 로그를 도와드릴 수 있어요.",
      Spanish: "Soy Mia, la asistente del informe de DFDS Customer Intelligence. Puedo ayudarte con routes, app reviews, competitors, recommendations, evidencia y el registro de cambios.",
      French: "Je suis Mia, l’assistante du rapport DFDS Customer Intelligence. Je peux aider avec les routes, app reviews, competitors, recommendations, les preuves et le journal des changements.",
      German: "Ich bin Mia, die Assistentin des DFDS Customer Intelligence Reports. Ich kann bei routes, app reviews, competitors, recommendations, Belegen und dem Änderungsprotokoll helfen.",
      Danish: "Jeg er Mia, assistenten i DFDS Customer Intelligence. Jeg kan hjælpe med routes, app reviews, competitors, recommendations, evidens og opdateringsloggen."
    };
    return responses[language] || "I’m Mia, the DFDS Customer Intelligence assistant. I can help with routes, app reviews, competitors, recommendations, evidence, and update logs.";
  }

  if (intent === "wellbeing") {
    const responses = {
      Chinese: "我状态很好，谢谢你。现在我可以继续帮你看 DFDS 报告里的 routes、app reviews 或 competitors。",
      Japanese: "元気です、ありがとう。DFDSレポートの routes、app reviews、competitors を続けて見られます。",
      Korean: "저는 잘 지내고 있어요, 감사합니다. 이제 DFDS 보고서의 routes, app reviews, competitors를 계속 볼 수 있어요.",
      Spanish: "Estoy bien, gracias. Puedo seguir ayudándote con las routes, app reviews o competitors del informe DFDS.",
      French: "Je vais bien, merci. Je peux continuer à vous aider avec les routes, les app reviews ou les competitors du rapport DFDS.",
      German: "Mir geht es gut, danke. Ich kann dir weiter bei den routes, app reviews oder competitors im DFDS-Bericht helfen.",
      Danish: "Jeg har det godt, tak. Jeg kan fortsætte med at hjælpe dig med routes, app reviews eller competitors i DFDS-rapporten."
    };
    return responses[language] || "I’m doing well, thanks. I can keep helping with DFDS routes, app reviews, or competitors.";
  }

  if (intent === "thanks") {
    const responses = {
      Chinese: "不客气，我是 Mia。你还想看 routes、app reviews、competitors 还是 recommendations？",
      Japanese: "どういたしまして、Miaです。routes、app reviews、competitors、recommendations のどれを見ますか？",
      Korean: "천만에요, Mia입니다. routes, app reviews, competitors, recommendations 중 무엇을 볼까요?",
      Spanish: "De nada, soy Mia. ¿Quieres ver routes, app reviews, competitors o recommendations?",
      French: "Avec plaisir, je suis Mia. Voulez-vous regarder les routes, les app reviews, les competitors ou les recommendations ?",
      German: "Gern geschehen, ich bin Mia. Möchtest du routes, app reviews, competitors oder recommendations ansehen?",
      Danish: "Selv tak, jeg er Mia. Vil du se routes, app reviews, competitors eller recommendations?"
    };
    return responses[language] || "You’re welcome. I’m Mia. Want to look at routes, app reviews, competitors, or recommendations?";
  }

  if (intent === "apology") {
    const responses = {
      Chinese: "没关系。我们可以直接回到 DFDS 报告里，你想看 routes、app reviews 还是 recommendations？",
      Japanese: "大丈夫です。DFDSレポートに戻りましょう。routes、app reviews、recommendations のどれを見ますか？",
      Korean: "괜찮아요. DFDS 보고서로 바로 돌아가죠. routes, app reviews, recommendations 중 무엇을 볼까요?",
      Spanish: "No pasa nada. Volvamos al informe DFDS. ¿Quieres ver routes, app reviews o recommendations?",
      French: "Ce n’est rien. Revenons au rapport DFDS. Voulez-vous voir les routes, les app reviews ou les recommendations ?",
      German: "Kein Problem. Gehen wir zurück zum DFDS-Bericht. Möchtest du routes, app reviews oder recommendations ansehen?",
      Danish: "Det er helt fint. Lad os gå tilbage til DFDS-rapporten. Vil du se routes, app reviews eller recommendations?"
    };
    return responses[language] || "No problem. Let’s get back to the DFDS report. Want routes, app reviews, or recommendations?";
  }

  if (intent === "joke") {
    const responses = {
      Chinese: "我不太会讲段子，但我可以把 DFDS 的证据讲得更清楚。想看路线、评论还是竞品？",
      Japanese: "おもしろネタは少し苦手ですが、DFDSの証拠はわかりやすくできます。ルート、レビュー、競合のどれを見ますか？",
      Korean: "농담은 조금 약하지만 DFDS 근거는 깔끔하게 설명할 수 있어요. 노선, 리뷰, 경쟁사 중 무엇을 볼까요?",
      Spanish: "No soy la mejor contando chistes, pero sí puedo aclarar la evidencia de DFDS. ¿Ruta, reviews o competidores?",
      French: "Je ne suis pas la meilleure pour les blagues, mais je peux clarifier les preuves DFDS. Route, avis ou concurrents ?",
      German: "Witze sind nicht meine Stärke, aber ich kann die DFDS-Belege klar erklären. Route, Bewertungen oder Wettbewerber?",
      Danish: "Jeg er ikke bedst til jokes, men jeg kan gøre DFDS-evidensen klar. Rute, anmeldelser eller konkurrenter?"
    };
    return responses[language] || "I’m better at DFDS evidence than jokes, but I can help with routes, reviews, or competitors.";
  }

  if (intent === "confusion") {
    const responses = {
      Chinese: "我可以换一种说法。你想先看 routes、app reviews、competitors，还是让我直接总结这一页？",
      Japanese: "別の言い方にできます。routes、app reviews、competitors のどれから見ますか？それともこのページを要約しましょうか？",
      Korean: "다른 방식으로 설명할게요. routes, app reviews, competitors 중 무엇부터 볼까요? 아니면 이 페이지를 바로 요약할까요?",
      Spanish: "Puedo decirlo de otra manera. ¿Quieres empezar por routes, app reviews o competitors, o prefieres un resumen de esta página?",
      French: "Je peux le reformuler. Voulez-vous commencer par les routes, les app reviews ou les competitors, ou un résumé de cette page ?",
      German: "Ich kann es anders formulieren. Willst du mit routes, app reviews oder competitors anfangen oder lieber eine Zusammenfassung dieser Seite?",
      Danish: "Jeg kan sige det på en anden måde. Vil du starte med routes, app reviews eller competitors, eller skal jeg bare opsummere siden?"
    };
    return responses[language] || "I can rephrase that. Want routes, app reviews, competitors, or a quick summary of this page?";
  }

  if (intent === "smallTalk") {
    const responses = {
      Chinese: "嗨，我是 Mia。我可以帮你看 DFDS 报告里的 routes、app reviews、competitors 和 recommendations。你想先看哪一块？",
      Japanese: "こんにちは、Miaです。DFDSレポートの routes、app reviews、competitors、recommendations をお手伝いできます。どこから見ましょうか？",
      Korean: "안녕하세요, Mia입니다. DFDS 보고서의 routes, app reviews, competitors, recommendations 를 도와드릴 수 있어요. 어디부터 볼까요?",
      Spanish: "Hola, soy Mia. Puedo ayudarte con las routes, app reviews, competitors y recommendations del informe de DFDS. ¿Por dónde quieres empezar?",
      French: "Bonjour, je suis Mia. Je peux vous aider avec les routes, les app reviews, les competitors et les recommendations du rapport DFDS. Par quoi voulez-vous commencer ?",
      German: "Hallo, ich bin Mia. Ich kann dir bei den routes, app reviews, competitors und recommendations im DFDS-Bericht helfen. Womit sollen wir anfangen?",
      Danish: "Hej, jeg er Mia. Jeg kan hjælpe med routes, app reviews, competitors og recommendations i DFDS-rapporten. Hvad vil du kigge på først?"
    };
    return responses[language] || "Hi, I’m Mia. I can help with DFDS routes, app reviews, competitors, and recommendations. What would you like to look at first?";
  }

  const responses = {
    Chinese: "嗨，我是 Mia。我可以帮你看 DFDS 报告里的 routes、app reviews、competitors 和 recommendations。你想先看哪一块？",
    Japanese: "こんにちは、Miaです。DFDSレポートの routes、app reviews、competitors、recommendations をお手伝いできます。どこから見ましょうか？",
    Korean: "안녕하세요, Mia입니다. DFDS 보고서의 routes, app reviews, competitors, recommendations 를 도와드릴 수 있어요. 어디부터 볼까요?",
    Spanish: "Hola, soy Mia. Puedo ayudarte con las routes, app reviews, competitors y recommendations del informe de DFDS. ¿Por dónde quieres empezar?",
    French: "Bonjour, je suis Mia. Je peux vous aider avec les routes, les app reviews, les competitors et les recommendations du rapport DFDS. Par quoi voulez-vous commencer ?",
    German: "Hallo, ich bin Mia. Ich kann dir bei den routes, app reviews, competitors und recommendations im DFDS-Bericht helfen. Womit sollen wir anfangen?",
    Danish: "Hej, jeg er Mia. Jeg kan hjælpe med routes, app reviews, competitors og recommendations i DFDS-rapporten. Hvad vil du kigge på først?"
  };

  return responses[language] || "Hi, I’m Mia. I can help with DFDS routes, app reviews, competitors, and recommendations. What would you like to look at first?";
}

function getLocalChatResponse(message) {
  const language = detectInputLanguage(message);
  const intent = classifyConversationIntent(message);
  const mode = classifyConversationMode(message);
  const activeView = getActiveView();
  const route = getEffectiveRoute(message);
  const routeName = data.routeInsights[route]?.title || "All signals";

  if (mode !== "vertical") {
    return {
      mode,
      key: intent,
      routeName,
      activeView,
      evidenceItems: [],
      sources: [],
      answer: buildBridgeResponse(language, intent)
    };
  }

  const evidenceItems = retrieveLocalEvidence(message, route);
  const sources = getEvidenceSources(evidenceItems);
  const evidenceRequested = shouldShowEvidenceDetails(message);
  const evidenceText = formatEvidenceBullets(evidenceItems, language);
  const sourceText = sources.length ? sources.join(language === "Chinese" ? "、" : ", ") : "";

  if (!evidenceItems.length) {
    return {
      mode,
      key: "bridge",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: buildBridgeResponse(language)
    };
  }

  if (evidenceRequested && language === "Chinese") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `简短结论：当前 ${activeView} / ${routeName} 的证据已经能支持一个方向性判断：优先看会影响客户信任和下一步行动的主题，而不是只看单条评论。\n\n这意味着：\n- 先把它当成 manager summary，用来判断 marketing / CX 要优先处理什么。\n- 再看下面的证据，确认这个判断来自哪些公开信号。\n- 如果要对外承诺，还需要继续补充更多真实来源或内部客户数据。\n\n使用到的证据：\n${evidenceText}\n\n来源：${sourceText || "暂无匹配来源"}。`
      };
  }

  if (evidenceRequested && language === "Japanese") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `現在のページとルート条件に合う公開エビデンスを確認しました。\n\n主なエビデンス:\n${evidenceText}\n\n参照した情報源: ${sourceText || "該当する情報源はありません"}。`
      };
  }

  if (evidenceRequested && language === "Korean") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `현재 페이지와 노선 조건에 맞는 공개 근거를 확인했습니다.\n\n주요 근거:\n${evidenceText}\n\n사용한 출처: ${sourceText || "일치하는 출처 없음"}.`
      };
  }

  if (evidenceRequested && language === "Spanish") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `Revisé la evidencia pública disponible para la página actual y el foco de ruta.\n\nEvidencia principal:\n${evidenceText}\n\nFuentes utilizadas: ${sourceText || "No matching source"}.`
      };
  }

  if (evidenceRequested && language === "French") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `J’ai consulté les preuves publiques disponibles pour la page actuelle et le filtre de route.\n\nPrincipales preuves :\n${evidenceText}\n\nSources utilisées : ${sourceText || "Aucune source correspondante"}.`
      };
  }

  if (evidenceRequested && language === "German") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `Ich habe die verfügbaren öffentlichen Hinweise für die aktuelle Seite und den Routenfokus geprüft.\n\nWichtigste Hinweise:\n${evidenceText}\n\nGenutzte Quellen: ${sourceText || "Keine passende Quelle"}.`
      };
  }

  if (evidenceRequested && language === "Danish") {
    return {
      mode,
      key: "retrieval",
      routeName,
      activeView,
      evidenceItems,
      sources,
      answer: `Jeg har gennemgået de offentlige signaler for den aktuelle side og rutefokus.\n\nVigtigste evidens:\n${evidenceText}\n\nKilder brugt: ${sourceText || "Ingen matchende kilde"}.`
      };
  }

  const plainSummary = {
    mode,
    key: "retrieval",
    routeName,
    activeView,
    evidenceItems,
    sources,
    answer:
      language === "Chinese"
        ? `当前 ${activeView} / ${routeName} 的公开信号已经足够支持一个方向性判断：先看最影响客户信任和下一步行动的主题，再决定 marketing / CX 该优先处理什么。`
        : `For ${activeView} / ${routeName}, the available public signals support a directional read: focus on the customer trust issue first, then decide what Marketing or CX should prioritize.`
  };

  return plainSummary;
}

async function getLiveChatResponse(message) {
  const language = detectInputLanguage(message);
  const intent = classifyConversationIntent(message);
  const mode = classifyConversationMode(message);
  const route = getEffectiveRoute(message);
  const routeName = data.routeInsights[route]?.title || "All signals";
  const activeView = getActiveView();

  if (mode !== "vertical") {
    return {
      mode,
      intent,
      answer: buildBridgeResponse(language, intent),
      evidence: [],
      insights: [],
      memories: []
    };
  }

  const evidenceItems = retrieveLocalEvidence(message, route);
  const pageContext = buildDashboardContext(activeView, route);

  return requestLiveChatResponse({
    message,
    language,
    activeView,
    routeKey: route,
    routeName,
    mode,
    intent,
    evidenceItems,
    pageContext
  });
}

function renderChatMessages() {
  const history = $("#messageHistory");
  if (!history) return;

  history.innerHTML = chatMessages
    .map((message) => {
      const evidenceCards = (message.evidence || [])
        .slice(0, 3)
        .map(
          (item) => `
            <article class="message-evidence-card">
              <span>${escapeHtml(item.source || "Evidence")}${item.evidence_id ? ` · ID ${escapeHtml(item.evidence_id)}` : ""}</span>
              <strong>${escapeHtml(item.title || item.type || "Supporting evidence")}</strong>
              <small>${escapeHtml([
                item.route,
                item.rating !== null && item.rating !== undefined ? `Rating ${item.rating}/5` : "",
                item.review_count ? `${item.review_count} reviews` : ""
              ].filter(Boolean).join(" · "))}</small>
            </article>
          `
        )
        .join("");

      return `
        <article class="message ${message.role}">
          <span class="message-label">${message.role === "user" ? "You" : "Mia"}</span>
          <div class="message-bubble">${escapeHtml(message.text)}</div>
          ${message.showEvidenceDetails && evidenceCards ? `<div class="message-evidence"><span>Supporting evidence</span>${evidenceCards}</div>` : ""}
        </article>
      `;
    })
    .join("");

  history.scrollTop = history.scrollHeight;
}

function renderSuggestedQuestions() {
  const container = $("#promptSuggestions");
  if (!container) return;

  container.innerHTML = `
    <span>Try asking</span>
    <div>
      ${suggestedQuestions
        .map(
          (item) => `
            <button class="prompt-chip" type="button" data-question="${escapeHtml(item.question)}">
              ${escapeHtml(item.label)}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

export function bindChatAssistant() {
  const widget = $("#chatWidget");
  const launcher = $("#chatLauncher");
  const close = $("#chatClose");
  const form = $("#chatForm");
  const input = $("#chatInput");
  const send = $("#sendButton");
  const promptSuggestions = $("#promptSuggestions");

  if (!widget || !launcher || !close || !form || !input || !send) return;

  const setOpen = (isOpen) => {
    widget.classList.toggle("open", isOpen);
    launcher.setAttribute("aria-expanded", String(isOpen));
    $("#chatPanel").setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      renderChatMessages();
      input.focus();
    }
  };

  launcher.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));

  promptSuggestions?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-question]");
    if (!chip) return;
    input.value = chip.dataset.question || "";
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    send.disabled = !input.value.trim();
    input.focus();
    form.requestSubmit();
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    send.disabled = !input.value.trim();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    chatMessages.push({ role: "user", text: message });
    const language = detectInputLanguage(message);
    const intent = classifyConversationIntent(message);
    const mode = classifyConversationMode(message);
    const evidenceRequested = shouldShowEvidenceDetails(message);

    if (mode !== "vertical") {
      chatMessages.push({
        role: "assistant",
        text: getLocalChatResponse(message).answer,
        showEvidenceDetails: false
      });
      input.value = "";
      input.style.height = "auto";
      send.disabled = true;
      renderChatMessages();
      return;
    }

    const localEvidence = retrieveLocalEvidence(message, getEffectiveRoute(message));

    if (!localEvidence.length) {
      chatMessages.push({
        role: "assistant",
        text: getLocalChatResponse(message).answer,
        showEvidenceDetails: false
      });
      input.value = "";
      input.style.height = "auto";
      send.disabled = true;
      renderChatMessages();
      return;
    }

    const pendingMessage = {
      role: "assistant",
      text: language === "Chinese" ? "我在整理答案..." : "Mia is putting the answer together..."
    };
    chatMessages.push(pendingMessage);
    input.value = "";
    input.style.height = "auto";
    send.disabled = true;
    renderChatMessages();

    try {
      const liveResponse = await getLiveChatResponse(message);
      pendingMessage.text = liveResponse.answer;
      pendingMessage.evidence = evidenceRequested ? liveResponse.evidence : [];
      pendingMessage.insights = liveResponse.insights;
      pendingMessage.memories = liveResponse.memories;
      pendingMessage.showEvidenceDetails = evidenceRequested;
    } catch (error) {
      const fallbackEvidence = retrieveLocalEvidence(message, getEffectiveRoute(message));
      const fallbackResponse = getLocalChatResponse(message);
      pendingMessage.text = fallbackResponse.answer;
      pendingMessage.evidence = evidenceRequested
        ? fallbackEvidence.map((item) => ({
            evidence_id: item.id,
            title: item.title,
            source: item.source,
            route: item.route,
            rating: null,
            review_count: null
          }))
        : [];
      pendingMessage.showEvidenceDetails = evidenceRequested;
    } finally {
      renderChatMessages();
    }
  });

  send.disabled = true;
  renderSuggestedQuestions();
  renderChatMessages();
}
