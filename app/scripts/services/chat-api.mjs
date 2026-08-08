import { getChatSessionId } from "./session.mjs";
import { getAccessToken } from "../../lib/auth.js";

function shouldShowEvidenceDetails(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return false;
  return /\b(evidence|source|sources|citation|citations|proof|supporting data|supporting evidence|show me why|where is this from|what is this based on)\b/i.test(text)
    || /(证据|佐证|来源|出处|引用|根据|支撑|原文|哪条|哪些数据|数据依据)/.test(String(message || ""));
}

export function cleanUserFacingAnswer(answer, originalMessage = "") {
  let cleaned = String(answer || "").trim();
  if (!cleaned) return cleaned;

  cleaned = cleaned
    .replace(/^\s*(Short answer|Answer)\s*:\s*/i, "")
    .replace(/^\s*简短结论\s*[:：]\s*/, "")
    .replace(/Evidence shown in this answer\s*:?/gi, "");

  if (shouldShowEvidenceDetails(originalMessage)) {
    return cleaned.replace(/(^|\n)\s*Evidence used\s*:\s*/gi, "$1Supporting evidence:\n").trim();
  }

  return cleaned
    .replace(/(^|\n)\s*Evidence used\s*:.*$/is, "")
    .replace(/(^|\n)\s*Sources\s*:.*$/is, "")
    .replace(/(^|\n)\s*使用到的证据\s*[:：].*$/is, "")
    .replace(/(^|\n)\s*来源\s*[:：].*$/is, "")
    .replace(/(^|\n)\s*Kilder brugt\s*:.*$/is, "")
    .replace(/(^|\n)\s*Fuentes utilizadas\s*:.*$/is, "")
    .replace(/(^|\n)\s*Sources utilisées\s*:.*$/is, "")
    .replace(/(^|\n)\s*Genutzte Quellen\s*:.*$/is, "")
    .replace(/(^|\n)\s*参照した情報源\s*:.*$/is, "")
    .replace(/(^|\n)\s*사용한 출처\s*:.*$/is, "")
    .trim();
}

export async function getLiveChatResponse(payload) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({
      sessionId: getChatSessionId(),
      ...payload
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "The DeepSeek backend is not available.");
  }

  return {
    answer: cleanUserFacingAnswer(
      result.answer || "No answer was returned by the live assistant.",
      payload.message
    ),
    evidence: result.evidence || [],
    insights: result.insights || [],
    memories: result.memories || [],
    mode: result.mode || "vertical",
    intent: result.intent || "report"
  };
}
