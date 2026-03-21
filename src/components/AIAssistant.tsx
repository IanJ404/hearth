import { useState, useRef, useEffect } from "react";
import { Send, BotMessageSquare, User, AlertCircle, Flame } from "lucide-react";
import { api } from "../api";
import type { ChatMessage } from "../types";

const SUGGESTIONS = [
  "Which lights are currently on?",
  "What is the temperature in the living room?",
  "Is the garage door closed?",
  "Which devices are offline?",
  "Suggest a night time automation",
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = (text || input).trim();
    if (!content || streaming) return;

    setInput("");
    setError(null);
    const userMsg: ChatMessage = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);
    setStreaming(true);

    await api.ai.chatStream(
      newMessages,
      (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + chunk },
            ];
          }
          return prev;
        });
      },
      () => {
        setStreaming(false);
        inputRef.current?.focus();
      },
      (err) => {
        setStreaming(false);
        setError(err);
        setMessages((prev) => prev.slice(0, -1));
      },
    );
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className="page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100vh",
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="page-title">AI Assistant</div>
          <div className="page-subtitle">
            Powered by LM Studio · Context-aware home intelligence
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 6px var(--green)",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            LM Studio
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #f59e0b22, #ef444422)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              <Flame size={26} color="#f59e0b" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
              HEARTH AI
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                maxWidth: 360,
                margin: "0 auto 28px",
              }}
            >
              Ask me about your home — device states, room status, energy usage,
              or automation suggestions.
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="btn btn-secondary btn-sm"
                  onClick={() => send(s)}
                  style={{ fontSize: 12 }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className="fade-in"
            style={{
              display: "flex",
              gap: 12,
              padding: "12px 4px",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background:
                  msg.role === "user"
                    ? "var(--accent-dim)"
                    : "rgba(245,158,11,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: msg.role === "user" ? "var(--accent)" : "#f59e0b",
                flexShrink: 0,
              }}
            >
              {msg.role === "user" ? (
                <User size={15} />
              ) : (
                <BotMessageSquare size={15} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                {msg.role === "user" ? "You" : "HEARTH AI"}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
                {streaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant" && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 14,
                        background: "var(--accent)",
                        marginLeft: 2,
                        verticalAlign: "middle",
                        animation: "pulse 1s infinite",
                      }}
                    />
                  )}
              </div>
            </div>
          </div>
        ))}

        {error && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 14px",
              background: "var(--red-dim)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              margin: "8px 0",
            }}
          >
            <AlertCircle
              size={15}
              color="var(--red)"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div
        style={{
          flexShrink: 0,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <input
          ref={inputRef}
          style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          placeholder="Ask about your home…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={streaming}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border)";
          }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: "10px 14px", flexShrink: 0 }}
          onClick={() => send()}
          disabled={!input.trim() || streaming}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
