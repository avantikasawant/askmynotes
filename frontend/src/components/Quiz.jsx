import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const DIFFICULTY = {
  easy:   { label: "Easy",   time: 600, color: "bg-green-500", border: "border-green-500", desc: "5 questions · 10 min · 2 attempts" },
  medium: { label: "Medium", time: 420, color: "bg-amber-500", border: "border-amber-500", desc: "7 questions · 7 min · 2 attempts" },
  hard:   { label: "Hard",   time: 300, color: "bg-red-500",   border: "border-red-500",   desc: "10 questions · 5 min · 2 attempts" },
};

function VideoCard({ topic }) {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.post(`${API_URL}/video`, { topic })
      .then(res => setVideo(res.data))
      .catch(() => setVideo({ error: true }))
      .finally(() => setLoading(false));
  }, [topic]);

  if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
  if (!video || video.error) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <iframe src={video.embed_url} title={video.title} width="100%" height="160"
        frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen />
      <div className="p-2 bg-gray-50">
        <p className="text-xs font-medium truncate text-slate-700">{video.title}</p>
        <p className="text-[10px] text-slate-400">{video.channel}</p>
      </div>
    </div>
  );
}

export default function Quiz({ onScoreSaved }) {
  const [stage, setStage] = useState("setup");
  const [difficulty, setDifficulty] = useState("medium");
  // attempts: { easy: 0, medium: 0, hard: 0 }
  const [attempts, setAttempts] = useState({ easy: 0, medium: 0, hard: 0 });
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (stage !== "quiz") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setAutoSubmitted(true);
          doSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage]);

  const formatTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const timerColor = timeLeft > 60 ? "text-green-500" : timeLeft > 30 ? "text-amber-500" : "text-red-500 animate-pulse";

  const startQuiz = async () => {
    if (attempts[difficulty] >= 2) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_URL}/quiz`, { difficulty });
      if (res.data.error) { setError(res.data.error); return; }
      setQuestions(res.data.questions || []);
      setSelected({});
      setTimeLeft(DIFFICULTY[difficulty].time);
      setAutoSubmitted(false);
      setAttempts(prev => ({ ...prev, [difficulty]: prev[difficulty] + 1 }));
      setStage("quiz");
    } catch {
      setError("Failed to generate quiz. Upload a PDF first.");
    } finally {
      setLoading(false);
    }
  };

  const doSubmit = async () => {
    clearInterval(timerRef.current);
    const score = questions.reduce((acc, q, i) => acc + (selected[i] === q.correct_index ? 1 : 0), 0);
    try {
      await axios.post(`${API_URL}/quiz/save?score=${score}&total=${questions.length}`);
      onScoreSaved?.();
    } catch {}
    setStage("results");
  };

  const handleSubmitClick = () => setShowConfirm(true);
  const handleConfirmSubmit = () => { setShowConfirm(false); doSubmit(); };
  const handleGoBack = () => {
    clearInterval(timerRef.current);
    // refund attempt since they went back
    setAttempts(prev => ({ ...prev, [difficulty]: Math.max(0, prev[difficulty] - 1) }));
    setStage("setup");
  };

  const handleSelect = (qIndex, oIndex) => {
    setSelected(prev => ({ ...prev, [qIndex]: oIndex }));
  };

  const score = questions.reduce((acc, q, i) => acc + (selected[i] === q.correct_index ? 1 : 0), 0);
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const attemptsLeft = 2 - attempts[difficulty];

  const optionStyle = (q, qIndex, oIndex) => {
    const base = "w-full text-left border rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-3";
    const isSelected = selected[qIndex] === oIndex;
    if (!isSelected) return `${base} border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 cursor-pointer`;
    return `${base} border-indigo-400 bg-indigo-50 text-indigo-700`;
  };

  const resultStyle = (q, qIndex, oIndex) => {
    const base = "px-3 py-2 rounded-lg text-xs flex items-center gap-2 border";
    const isCorrect = oIndex === q.correct_index;
    const isSelected = selected[qIndex] === oIndex;
    if (isCorrect) return `${base} bg-green-50 border-green-200 text-green-700`;
    if (isSelected) return `${base} bg-red-50 border-red-200 text-red-600`;
    return `${base} border-gray-100 text-slate-400`;
  };

  // ── SETUP ──
  if (stage === "setup") return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Take a Test</h2>
        <p className="text-sm mt-1 text-slate-500">Choose difficulty — each level has 2 attempts.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Select Difficulty</p>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(DIFFICULTY).map(([key, d]) => {
            const used = attempts[key];
            const locked = used >= 2;
            return (
              <button key={key} onClick={() => !locked && setDifficulty(key)} disabled={locked}
                className={`p-4 rounded-xl border-2 text-center transition-all relative
                  ${difficulty === key && !locked ? `${d.border} bg-slate-50` : "border-gray-200 hover:border-gray-300"}
                  ${locked ? "opacity-40 cursor-not-allowed" : ""}`}>
                <div className={`w-3 h-3 rounded-full ${d.color} mx-auto mb-2`} />
                <p className="font-semibold text-sm text-slate-800">{d.label}</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-tight">{d.desc}</p>
                {/* Attempts indicator */}
                <div className="flex justify-center gap-1 mt-2">
                  {[0, 1].map(i => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i < used ? "bg-red-400" : "bg-gray-200"}`} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {locked ? "No attempts left" : `${attemptsLeft === 2 && key === difficulty ? "2" : 2 - used} attempt${2 - used === 1 ? "" : "s"} left`}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <button onClick={startQuiz} disabled={loading || attempts[difficulty] >= 2}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-4 font-bold text-base hover:opacity-90 disabled:opacity-50 transition shadow-lg">
        {loading ? "Generating..." : attempts[difficulty] >= 2 ? "No attempts remaining" : `Start ${DIFFICULTY[difficulty].label} Test →`}
      </button>
    </div>
  );

  // ── QUIZ ──
  if (stage === "quiz") return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Confirm submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-lg font-bold text-slate-900 mb-2">Submit Test?</p>
            <p className="text-sm text-slate-500 mb-5">
              You've answered {Object.keys(selected).length} of {questions.length} questions.
              {Object.keys(selected).length < questions.length && (
                <span className="text-amber-600 font-medium"> {questions.length - Object.keys(selected).length} unanswered.</span>
              )} Are you sure?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-slate-600 hover:bg-gray-50 transition">
                Go Back
              </button>
              <button onClick={handleConfirmSubmit}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between sticky top-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={handleGoBack}
            className="text-xs text-slate-500 hover:text-slate-700 border border-gray-200 rounded-lg px-3 py-1.5 transition">
            ← Back
          </button>
          <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2.5 py-1 rounded-lg">
            {DIFFICULTY[difficulty].label}
          </span>
          <span className="text-xs text-slate-400">{Object.keys(selected).length}/{questions.length} answered</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-lg ${timerColor}`}>⏱ {formatTime(timeLeft)}</span>
          <button onClick={handleSubmitClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition">
            Submit
          </button>
        </div>
      </div>

      {questions.map((q, qIndex) => (
        <div key={qIndex} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
              {qIndex + 1}
            </span>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{q.question}</p>
          </div>
          <div className="space-y-2 ml-10">
            {q.options.map((opt, oIndex) => (
              <button key={oIndex} onClick={() => handleSelect(qIndex, oIndex)}
                className={optionStyle(q, qIndex, oIndex)}>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0
                  ${selected[qIndex] === oIndex ? "border-indigo-500 bg-indigo-100 text-indigo-600" : "border-gray-300 text-gray-400"}`}>
                  {["A","B","C","D"][oIndex]}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button onClick={handleSubmitClick}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-4 font-bold text-base hover:opacity-90 transition shadow-lg">
        Submit Test →
      </button>
    </div>
  );

  // ── RESULTS ──
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {autoSubmitted && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center text-sm text-amber-700 font-medium">
          ⏰ Time's up — test auto-submitted
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-black
          ${pct >= 80 ? "bg-green-100 text-green-600" : pct >= 50 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
          {pct}%
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{score} / {questions.length} Correct</h2>
        <p className="text-sm mt-1 text-slate-500">
          {pct >= 80 ? "Excellent! 🎉" : pct >= 50 ? "Good effort 👍" : "Keep studying 📚"}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          {DIFFICULTY[difficulty].label} · {attempts[difficulty]}/2 attempts used
        </p>

        {/* Retake button — shown only if attempts remain */}
        <div className="flex gap-3 justify-center mt-5">
          {attempts[difficulty] < 2 && (
            <button onClick={() => { setStage("setup"); }}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition">
              🔄 Retake {DIFFICULTY[difficulty].label} ({2 - attempts[difficulty]} left)
            </button>
          )}
          <button onClick={() => { setStage("setup"); setDifficulty("easy"); }}
            className="border border-gray-200 text-slate-600 rounded-xl px-5 py-2.5 font-semibold text-sm hover:bg-gray-50 transition">
            Try Different Level
          </button>
        </div>
      </div>

      {/* Full review */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Full Review</p>
        <div className="space-y-4">
          {questions.map((q, qIndex) => {
            const isCorrect = selected[qIndex] === q.correct_index;
            return (
              <div key={qIndex} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                    {isCorrect ? "✓" : "✗"}
                  </span>
                  <p className="text-sm font-semibold text-slate-800">{q.question}</p>
                </div>

                <div className="space-y-1.5 ml-10 mb-3">
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className={resultStyle(q, qIndex, oIndex)}>
                      <span className="font-bold">{["A","B","C","D"][oIndex]}.</span>
                      {opt}
                      {oIndex === q.correct_index && <span className="ml-auto font-bold shrink-0">✓ Correct</span>}
                      {oIndex === selected[qIndex] && oIndex !== q.correct_index && <span className="ml-auto shrink-0 text-red-500">Your answer</span>}
                    </div>
                  ))}
                </div>

                {q.explanation && (
                  <div className="ml-10 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 mb-3">
                    <span className="font-semibold">💡 </span>{q.explanation}
                  </div>
                )}

                <div className="ml-10">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Reference Video</p>
                  <VideoCard topic={q.question} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
