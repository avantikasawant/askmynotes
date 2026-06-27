import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

const DIFFICULTY = {
  easy:   { label: "Easy",   time: 600, color: "bg-green-500",  border: "border-green-500",  desc: "10 min" },
  medium: { label: "Medium", time: 420, color: "bg-amber-500",  border: "border-amber-500",  desc: "7 min" },
  hard:   { label: "Hard",   time: 300, color: "bg-red-500",    border: "border-red-500",    desc: "5 min" },
};

function VideoCard({ topic, dark }) {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.post(`${API_URL}/video`, { topic })
      .then(res => setVideo(res.data))
      .catch(() => setVideo({ error: "No video found" }))
      .finally(() => setLoading(false));
  }, [topic]);

  if (loading) return (
    <div className={`rounded-xl p-3 ${dark ? "bg-slate-700" : "bg-gray-50"} animate-pulse`}>
      <div className="h-24 bg-gray-200 rounded-lg mb-2" />
      <div className="h-3 bg-gray-200 rounded w-3/4" />
    </div>
  );

  if (!video || video.error) return null;

  return (
    <div className={`rounded-xl overflow-hidden border ${dark ? "border-slate-600" : "border-gray-200"}`}>
      <iframe src={video.embed_url} title={video.title} width="100%" height="160"
        frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen />
      <div className={`p-2 ${dark ? "bg-slate-700" : "bg-gray-50"}`}>
        <p className={`text-xs font-medium truncate ${dark ? "text-slate-300" : "text-slate-700"}`}>{video.title}</p>
        <p className={`text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>{video.channel}</p>
      </div>
    </div>
  );
}

export default function Quiz({ onScoreSaved }) {
  const { dark } = useTheme();
  const [stage, setStage] = useState("setup"); // setup | quiz | results
  const [difficulty, setDifficulty] = useState("medium");
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef(null);

  const card = `rounded-2xl border ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  // Timer
  useEffect(() => {
    if (stage !== "quiz" || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage, submitted]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const timerColor = timeLeft > 60 ? "text-green-400" : timeLeft > 30 ? "text-amber-400" : "text-red-400 animate-pulse";

  const startQuiz = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_URL}/quiz`, { difficulty });
      if (res.data.error) { setError(res.data.error); return; }
      setQuestions(res.data.questions || []);
      setSelected({});
      setTimeLeft(DIFFICULTY[difficulty].time);
      setStage("quiz");
      setSubmitted(false);
    } catch {
      setError("Failed to generate quiz. Upload a PDF first.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex, oIndex) => {
    if (submitted) return;
    setSelected(prev => ({ ...prev, [qIndex]: oIndex }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    clearInterval(timerRef.current);
    setSubmitted(true);
    const score = questions.reduce((acc, q, i) => acc + (selected[i] === q.correct_index ? 1 : 0), 0);
    try {
      await axios.post(`${API_URL}/quiz/save?score=${score}&total=${questions.length}`);
      onScoreSaved?.();
    } catch {}
    setStage("results");
  };

  const score = questions.reduce((acc, q, i) => acc + (selected[i] === q.correct_index ? 1 : 0), 0);
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  const optionStyle = (q, qIndex, oIndex) => {
    const base = `w-full text-left border rounded-xl px-4 py-3 text-sm transition-all duration-150 flex items-center gap-3`;
    const isAnswered = submitted || selected[qIndex] !== undefined;
    const isSelected = selected[qIndex] === oIndex;
    const isCorrect = oIndex === q.correct_index;

    if (!isAnswered || (!submitted && !isSelected)) {
      return `${base} ${dark
        ? isSelected ? "border-indigo-500 bg-indigo-900/30 text-indigo-300" : "border-slate-600 hover:border-indigo-500 hover:bg-slate-700 text-slate-300 cursor-pointer"
        : isSelected ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 cursor-pointer"}`;
    }
    if (isCorrect) return `${base} border-green-500 ${dark ? "bg-green-900/30 text-green-300" : "bg-green-50 text-green-700"}`;
    if (isSelected && !isCorrect) return `${base} border-red-500 ${dark ? "bg-red-900/30 text-red-300" : "bg-red-50 text-red-700"}`;
    return `${base} ${dark ? "border-slate-700 text-slate-500" : "border-gray-100 text-slate-400"}`;
  };

  // SETUP SCREEN
  if (stage === "setup") return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Take a Test</h2>
        <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
          5 questions generated from your notes. Choose your difficulty.
        </p>
      </div>

      <div className={`${card} p-6`}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? "text-slate-500" : "text-slate-400"}`}>Select Difficulty</p>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(DIFFICULTY).map(([key, d]) => (
            <button key={key} onClick={() => setDifficulty(key)}
              className={`p-4 rounded-xl border-2 text-center transition-all
                ${difficulty === key
                  ? `${d.border} ${dark ? "bg-slate-700" : "bg-slate-50"}`
                  : dark ? "border-slate-700 hover:border-slate-500" : "border-gray-200 hover:border-gray-300"}`}>
              <div className={`w-3 h-3 rounded-full ${d.color} mx-auto mb-2`} />
              <p className={`font-semibold text-sm ${dark ? "text-white" : "text-slate-800"}`}>{d.label}</p>
              <p className={`text-xs mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{d.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <button onClick={startQuiz} disabled={loading}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-4 font-bold text-base hover:opacity-90 disabled:opacity-50 transition shadow-lg">
        {loading ? "Generating questions..." : `Start ${DIFFICULTY[difficulty].label} Test →`}
      </button>
    </div>
  );

  // QUIZ SCREEN
  if (stage === "quiz") return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fadeIn">
      {/* Header bar */}
      <div className={`${card} p-4 flex items-center justify-between sticky top-4 z-10`}>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${dark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
            {DIFFICULTY[difficulty].label}
          </span>
          <span className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {Object.keys(selected).length}/{questions.length} answered
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-lg ${timerColor}`}>⏱ {formatTime(timeLeft)}</span>
          <button onClick={() => handleSubmit(false)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition">
            Submit
          </button>
        </div>
      </div>

      {questions.map((q, qIndex) => (
        <div key={qIndex} className={`${card} p-5 animate-fadeIn`}>
          <div className="flex items-start gap-3 mb-4">
            <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${dark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
              {qIndex + 1}
            </span>
            <p className={`text-sm font-semibold leading-snug ${dark ? "text-white" : "text-slate-800"}`}>{q.question}</p>
          </div>
          <div className="space-y-2 ml-10">
            {q.options.map((opt, oIndex) => (
              <button key={oIndex} onClick={() => handleSelect(qIndex, oIndex)}
                className={optionStyle(q, qIndex, oIndex)}>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0
                  ${selected[qIndex] === oIndex
                    ? "border-current bg-current/20"
                    : dark ? "border-slate-600" : "border-gray-300"}`}>
                  {["A","B","C","D"][oIndex]}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button onClick={() => handleSubmit(false)}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-4 font-bold text-base hover:opacity-90 transition shadow-lg">
        Submit Test →
      </button>
    </div>
  );

  // RESULTS SCREEN
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slideUp">
      {/* Score card */}
      <div className={`${card} p-8 text-center`}>
        <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-black
          ${pct >= 80 ? "bg-green-100 text-green-600" : pct >= 50 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
          {pct}%
        </div>
        <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>
          {score} / {questions.length} Correct
        </h2>
        <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
          {pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Good effort — review below 👍" : "Keep studying — explanations below 📚"}
        </p>
        <div className={`flex justify-center gap-4 mt-4 text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
          <span>Difficulty: <strong className={dark ? "text-white" : "text-slate-800"}>{DIFFICULTY[difficulty].label}</strong></span>
          <span>Time: <strong className={dark ? "text-white" : "text-slate-800"}>{DIFFICULTY[difficulty].desc}</strong></span>
        </div>
        <button onClick={() => setStage("setup")}
          className="mt-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-6 py-2.5 font-semibold text-sm hover:opacity-90 transition">
          Take Another Test
        </button>
      </div>

      {/* Full review with answers + videos */}
      <div>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>
          Full Review
        </p>
        <div className="space-y-4">
          {questions.map((q, qIndex) => {
            const isCorrect = selected[qIndex] === q.correct_index;
            return (
              <div key={qIndex} className={`${card} p-5`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                    {isCorrect ? "✓" : "✗"}
                  </span>
                  <p className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-800"}`}>{q.question}</p>
                </div>

                <div className="space-y-1.5 ml-10 mb-3">
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2
                      ${oIndex === q.correct_index
                        ? dark ? "bg-green-900/30 border border-green-700 text-green-300" : "bg-green-50 border border-green-200 text-green-700"
                        : oIndex === selected[qIndex]
                          ? dark ? "bg-red-900/30 border border-red-700 text-red-300" : "bg-red-50 border border-red-200 text-red-600"
                          : dark ? "border border-slate-700 text-slate-500" : "border border-gray-100 text-slate-400"}`}>
                      <span className="font-bold">{["A","B","C","D"][oIndex]}.</span>
                      {opt}
                      {oIndex === q.correct_index && <span className="ml-auto font-bold">✓ Correct</span>}
                      {oIndex === selected[qIndex] && oIndex !== q.correct_index && <span className="ml-auto">Your answer</span>}
                    </div>
                  ))}
                </div>

                {q.explanation && (
                  <div className={`ml-10 rounded-xl p-3 text-xs mb-3
                    ${dark ? "bg-slate-700 text-slate-300" : "bg-slate-50 text-slate-600"}`}>
                    <span className="font-semibold">💡 </span>{q.explanation}
                  </div>
                )}

                <div className="ml-10">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    Reference Video
                  </p>
                  <VideoCard topic={q.question} dark={dark} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
