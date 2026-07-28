import { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

function ChatBubble({ entry, dark }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = entry.role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1 animate-fadeIn`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm shadow-md"
          : dark ? "bg-slate-700 border border-slate-600 text-slate-200 rounded-bl-sm" : "bg-white border border-gray-100 text-slate-800 rounded-bl-sm shadow-sm"}`}>
        <p className="whitespace-pre-wrap">
          {entry.content}
          {entry.streaming && <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />}
        </p>
        {entry.cached && <span className="text-[10px] text-indigo-300 mt-1 block">⚡ cached</span>}
      </div>

      {!isUser && entry.sources?.length > 0 && !entry.streaming && (
        <div className="max-w-[85%] w-full">
          <button onClick={() => setShowSources(!showSources)}
            className={`text-[11px] flex items-center gap-1 ml-1 transition-colors
              ${dark ? "text-slate-500 hover:text-indigo-400" : "text-slate-400 hover:text-indigo-500"}`}>
            <span>{showSources ? "▾" : "▸"}</span>
            {entry.sources.length} source{entry.sources.length > 1 ? "s" : ""} · pages {entry.sources.map(s => s.page).join(", ")}
          </button>
          {showSources && entry.sources.map((s, i) => (
            <div key={i} className={`mt-1 rounded-xl p-3 text-xs animate-fadeIn
              ${dark ? "bg-slate-700 border border-slate-600" : "bg-indigo-50 border border-indigo-100"}`}>
              <p className={`font-semibold mb-1 ${dark ? "text-indigo-400" : "text-indigo-500"}`}>📄 {s.file} — Page {s.page}</p>
              <p className={`italic ${dark ? "text-slate-400" : "text-slate-600"}`}>"{s.snippet}..."</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingIndicator({ dark }) {
  return (
    <div className="flex items-start animate-fadeIn">
      <div className={`rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm
        ${dark ? "bg-slate-700 border border-slate-600" : "bg-white border border-gray-100"}`}>
        <div className="flex gap-1 items-center h-4">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function QnA() {
  const { dark } = useTheme();
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, loading]);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setHistory(prev => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setError("");
    const streamId = Date.now();
    setHistory(prev => [...prev, { role: "assistant", content: "", streaming: true, id: streamId, sources: [] }]);

    try {
      const token = localStorage.getItem("amn_token");
      const response = await fetch(`${API_URL}/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
        for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              setHistory(prev => prev.map(m => m.id === streamId ? { ...m, content: fullText } : m));
            }
            if (data.done) sources = data.sources || [];
          } catch {}
        }
      }
      setHistory(prev => prev.map(m => m.id === streamId ? { ...m, content: fullText, streaming: false, sources } : m));
    } catch {
      setHistory(prev => prev.filter(m => m.id !== streamId));
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = ["Summarise this document", "What are the key concepts?", "Explain the main topic"];

  return (
    <div className="max-w-2xl mx-auto flex flex-col animate-fadeIn" style={{ height: "calc(100vh - 160px)", minHeight: 400 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Ask Questions</h2>
        {history.length > 0 && (
          <button onClick={() => { setHistory([]); setError(""); }}
            className={`text-xs transition-colors ${dark ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-400"}`}>
            Clear chat
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto rounded-2xl border p-4 space-y-4
        ${dark ? "bg-slate-800/50 border-slate-700" : "bg-white/60 border-gray-100 shadow-sm"}`}>
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <span className="text-5xl">💬</span>
            <p className={`text-sm font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>
              Ask anything about your notes
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQuestion(s); textareaRef.current?.focus(); }}
                  className={`text-xs rounded-full px-3 py-1 transition-colors border
                    ${dark ? "bg-slate-700 border-slate-600 text-slate-300 hover:border-indigo-500 hover:text-indigo-400"
                      : "bg-white border-gray-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-500"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((entry, i) => <ChatBubble key={i} entry={entry} dark={dark} />)}
        {loading && history[history.length - 1]?.role !== "assistant" && <TypingIndicator dark={dark} />}
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className={`mt-3 flex gap-2 items-end rounded-2xl border p-2 transition-colors
        ${dark ? "bg-slate-800 border-slate-700 focus-within:border-indigo-500" : "bg-white border-gray-200 focus-within:border-indigo-300 shadow-sm"}`}>
        <textarea ref={textareaRef} value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
          placeholder="Ask a question… (Enter to send)"
          rows={1}
          className={`flex-1 resize-none outline-none text-sm bg-transparent px-2 py-1 max-h-32 overflow-y-auto
            ${dark ? "text-slate-200 placeholder-slate-600" : "text-slate-700 placeholder-slate-400"}`}
          style={{ minHeight: "36px" }} />
        <button onClick={handleAsk} disabled={loading || !question.trim()}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition shrink-0">
          {loading ? "..." : "Send →"}
        </button>
      </div>
    </div>
  );
}
