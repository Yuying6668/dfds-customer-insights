import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "./common.jsx";
import { getRouteLabel } from "../lib/router.js";
import { detectInputLanguage } from "../scripts/utils/format.mjs";
import { getLiveChatResponse } from "../scripts/services/chat-api.mjs";
import { buildDashboardContext } from "../scripts/services/dashboard-context.mjs";

const suggestedTags = [
  {
    label: "App risk",
    question: "What is the biggest app-related customer risk, and what should Mia's Cruises fix first?"
  },
  {
    label: "Route priority",
    question: "Which route needs the most careful customer communication right now, and why?"
  },
  {
    label: "Passenger profile",
    question: "Using the passenger profile data, which customer segments prefer which route clusters and products?"
  },
  {
    label: "IT Data Flow",
    question: "How does the upload-to-Mia data flow work, and where should version control and reliability checks sit?"
  },
  {
    label: "ACTAR",
    question: "Summarize the Passenger Profile ACTAR output and recommend what Marketing should do first."
  },
  {
    label: "Dover-Calais",
    question: "What does the evidence say about Dover-Calais delay guidance and ticket-rule clarity?"
  },
  {
    label: "Competitors",
    question: "What can Mia's Cruises learn from the competitor benchmark without overclaiming?"
  },
  {
    label: "Marketing actions",
    question: "Give me the top three recommendations for Marketing and CX, with evidence IDs."
  },
  {
    label: "Evidence gaps",
    question: "Where is the current evidence base still thin, and what should we collect next?"
  }
];

function assistantIntro() {
  return "Hi, I’m Mia. I can turn this report’s evidence into a quick read on app risk, route priorities, passenger profile, data flow, and next actions.";
}

function thinkingText(language) {
  const messages = {
    Chinese: "Mia 正在整理答案...",
    Danish: "Mia samler svaret...",
    Spanish: "Mia está preparando la respuesta...",
    French: "Mia prépare la réponse...",
    German: "Mia stellt die Antwort zusammen...",
    Japanese: "Mia が答えをまとめています...",
    Korean: "Mia가 답변을 정리하고 있어요..."
  };

  return messages[language] || "Mia is putting the answer together...";
}

function buildMessage(role, text, extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    ...extra
  };
}

function resizeChatInput(textarea) {
  if (!textarea) return;
  const maxHeight = 220;
  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

export function ChatWidget({ pathname, routeFocus, uploadBatchId }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([buildMessage("assistant", assistantIntro())]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState("English");
  const inputRef = useRef(null);

  const routeLabel = useMemo(() => getRouteLabel(pathname), [pathname]);

  useEffect(() => {
    resizeChatInput(inputRef.current);
  }, [input, open]);

  const handleSuggestedQuestion = (question) => {
    setInput(question);
    if (!open) setOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      resizeChatInput(inputRef.current);
    }, 0);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const language = detectInputLanguage(text);

    setLoading(true);
    setPendingLanguage(language);
    setMessages((current) => [...current, buildMessage("user", text)]);
    setInput("");

    try {
      const result = await getLiveChatResponse({
        message: text,
        language,
        activeView: routeLabel,
        routeKey: routeFocus,
        routeName: routeLabel,
        pageContext: buildDashboardContext(routeLabel, routeFocus),
        uploadBatchId: uploadBatchId || undefined
      });

      setMessages((current) => [
        ...current,
        buildMessage("assistant", result.answer, {
          mode: result.mode,
          intent: result.intent
        })
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        buildMessage("assistant", error.message || "Mia is temporarily unavailable right now.")
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={`chat-widget${open ? " open" : ""}${expanded ? " expanded" : ""}`}
      aria-label="Mia chat assistant"
    >
      {!open ? (
        <button
          className="chat-launcher"
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded="false"
          aria-controls="chatPanel"
          aria-label="Expand Mia insight copilot"
          title="Expand Mia"
        >
          <span aria-hidden="true">↗</span>
          Ask Mia
        </button>
      ) : null}

      <div className="chat-drawer" id="chatPanel" aria-hidden={String(!open)}>
        <header className="chat-header">
          <div className="chat-header-main">
            <p className="eyebrow">Mia's Cruises Customer Intelligence</p>
            <h3>Mia, your insight copilot</h3>
            <Badge tone="neutral">{routeLabel}</Badge>
          </div>
          <div className="chat-header-actions">
            <button
              className="chat-expand"
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-pressed={expanded}
              aria-label={expanded ? "Compact Mia chat" : "Expand Mia chat"}
              title={expanded ? "Compact Mia" : "Expand Mia"}
            >
              {expanded ? "−" : "↗"}
            </button>
            <button
              className="chat-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Compact Mia insight copilot"
              title="Compact Mia"
            >
              −
            </button>
          </div>
        </header>

        <div className="chat-note">
          Ask Mia to turn evidence into route, app, profile, data flow, and next-action decisions.
        </div>

        <div className="message-history" aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <span className="message-label">{message.role === "user" ? "You" : "Mia"}</span>
              <div className="message-bubble">{message.text}</div>
            </article>
          ))}
          {loading ? (
            <article className="message assistant">
              <span className="message-label">Mia</span>
              <div className="message-bubble">{thinkingText(pendingLanguage)}</div>
            </article>
          ) : null}
        </div>

        <div className="prompt-suggestions" aria-label="Suggested focus tags for Mia">
          <span>Focus tags</span>
          <div>
            {suggestedTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                className="prompt-chip"
                onClick={() => handleSuggestedQuestion(tag.question)}
                aria-label={`Ask Mia about ${tag.label}`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chatInput">
            Ask a question about the report
          </label>
          <textarea
            ref={inputRef}
            id="chatInput"
            name="message"
            rows="2"
            placeholder="Ask about routes, app reviews, root causes, competitors..."
            autoComplete="off"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="send-button" type="submit" disabled={loading}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
