import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

function ChatBubble({ entry }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = entry.role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1 animate-fadeIn`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
        ${isUser
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm"}`}>
        <p className="whitespace-pre-wrap">
          {entry.content}
          {entry.streaming && (
            <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </p>
        {entry.cached && (
          <span className="text-[10px] text-indigo-300 mt-1 block">⚡ cached response</span>
        )}
      </div>

      {!isUser && entry.sources?.length > 0 && !entry.streaming && (
        <div className="max-w-[85%] w-full">
          <button onClick={() => setShowSources(!showSources)}
            className="text-[11px] text-indigo-400 hover:text-indigo-600 flex items-center gap-1 ml-1 transition-colors">
            <span>{showSources ? "▾" : "▸"}</span>
            {entry.sources.length} source{entry.sources.length > 1 ? "s" : ""} · pages {entry.sources.map(s => s.page).join(", ")}
          </button>
          {showSources && (
            <div className="mt-1 space-y-2">
              {entry.sources.map((s, i) => (
                <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 animate-fadeIn">
                  <p className="text-[11px] font-semibold text-indigo-500 mb-1">📄 {s.file} — Page {s.page}</p>
                  <p className="text-xs text-gray-600 italic">"{s.snippet}..."</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start animate-fadeIn">
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function QnA() {
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || loading) return;

    setHistory(prev => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setError("");

    // Add streaming placeholder
    const streamId = Date.now();
    setHistory(prev => [...prev, { role: "assistant", content: "", streaming: true, id: streamId, sources: [] }]);

    try {
      const token = localStorage.getItem("amn_token");
      const response = await fetch(`${API_URL}/ask/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let sources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              setHistory(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: fullText } : m
              ));
            }
            if (data.done) {
              sources = data.sources || [];
            }
          } catch {}
        }
      }

      // Finalize message
      setHistory(prev => prev.map(m =>
        m.id === streamId ? { ...m, content: fullText, streaming: false, sources } : m
      ));
    } catch (err) {
      setHistory(prev => prev.filter(m => m.id !== streamId));
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const SUGGESTIONS = [
    "Summarise this document",
    "What are the key concepts?",
    "Explain the main topic",
  ];

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">Chat with Your Notes</h2>
        {history.length > 0 && (
          <button onClick={() => { setHistory([]); setError(""); }}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors">
            Clear chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-white/60 backdrop-blur rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-gray-400">
            <span className="text-5xl">💬</span>
            <p className="text-sm font-medium">Ask anything about your uploaded notes</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => { setQuestion(s); textareaRef.current?.focus(); }}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((entry, i) => <ChatBubble key={i} entry={entry} />)}
        {loading && history[history.length - 1]?.role !== "assistant" && <TypingIndicator />}
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2 items-end bg-white rounded-2xl border border-gray-200 shadow-sm p-2">
        <textarea ref={textareaRef} value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="flex-1 resize-none outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent px-2 py-1 max-h-32 overflow-y-auto"
          style={{ minHeight: "36px" }} />
        <button onClick={handleAsk} disabled={loading || !question.trim()}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition shrink-0">
          {loading ? "..." : "Send →"}
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-300 mt-1">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
