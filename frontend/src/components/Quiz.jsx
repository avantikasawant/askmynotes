import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

function QuizSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-5" />
          <div className="space-y-2">
            {[1,2,3,4].map(j => <div key={j} className="h-9 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoModal({ topic, onClose }) {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useState(() => {
    axios.post(`${API_URL}/video`, { topic })
      .then(res => setVideo(res.data))
      .catch(() => setError("Could not find a video for this topic."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Reference Video</p>
            <p className="text-xs text-gray-400 truncate max-w-xs">{topic}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}
          {video && !video.error && (
            <div>
              <div className="rounded-xl overflow-hidden bg-black mb-3">
                <iframe
                  src={video.embed_url}
                  title={video.title}
                  width="100%"
                  height="240"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{video.title}</p>
              <p className="text-xs text-gray-400 mt-1">{video.channel}</p>
              <a href={video.watch_url} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-indigo-500 hover:underline">
                Watch on YouTube ↗
              </a>
            </div>
          )}
          {video?.error && <p className="text-sm text-gray-400 text-center py-8">{video.error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Quiz() {
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoTopic, setVideoTopic] = useState(null);
  const [scoreSaved, setScoreSaved] = useState(false);

  const fetchQuiz = async () => {
    setLoading(true);
    setError("");
    setQuestions([]);
    setSelected({});
    setScoreSaved(false);

    try {
      const res = await axios.post(`${API_URL}/quiz`);
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setQuestions(res.data.questions || []);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate quiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex, oIndex) => {
    if (selected[qIndex] !== undefined) return;
    const updated = { ...selected, [qIndex]: oIndex };
    setSelected(updated);

    // Auto-save score once all answered
    if (Object.keys(updated).length === questions.length && !scoreSaved) {
      const score = questions.reduce((acc, q, i) => acc + (updated[i] === q.correct_index ? 1 : 0), 0);
      axios.post(`${API_URL}/quiz/save?score=${score}&total=${questions.length}`)
        .then(() => setScoreSaved(true))
        .catch(() => {});
    }
  };

  const optionStyle = (q, qIndex, oIndex) => {
    const isAnswered = selected[qIndex] !== undefined;
    const isThisSelected = selected[qIndex] === oIndex;
    const isCorrect = oIndex === q.correct_index;
    if (!isAnswered) return "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer text-gray-700";
    if (isCorrect) return "border-green-400 bg-green-50 text-green-800 font-medium";
    if (isThisSelected) return "border-red-400 bg-red-50 text-red-700";
    return "border-gray-100 text-gray-400";
  };

  const answeredCount = Object.keys(selected).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const score = questions.reduce((acc, q, i) => acc + (selected[i] === q.correct_index ? 1 : 0), 0);
  const scoreEmoji = score === questions.length ? "🎉" : score >= questions.length / 2 ? "👍" : "📚";
  const scoreMessage = score === questions.length ? "Perfect score! Outstanding work."
    : score >= questions.length / 2 ? "Good effort! Review the explanations below."
    : "Keep studying — the explanations below will help.";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {videoTopic && <VideoModal topic={videoTopic} onClose={() => setVideoTopic(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Quiz Yourself</h2>
            <p className="text-xs text-gray-400">Generated from your notes via Groq Llama 3.1</p>
          </div>
          {allAnswered && (
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-600">{score}/{questions.length}</p>
              <p className="text-xs text-gray-400">{scoreSaved ? "✅ saved" : "saving..."}</p>
            </div>
          )}
        </div>
        <button onClick={fetchQuiz} disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold hover:opacity-90 disabled:opacity-50 transition shadow-md text-sm">
          {loading ? "Generating quiz..." : questions.length > 0 ? "🔄 Generate New Quiz" : "🧠 Generate 5 MCQs"}
        </button>
        {error && <p className="mt-3 text-sm text-red-500 text-center">{error}</p>}
      </div>

      {loading && <QuizSkeleton />}

      {allAnswered && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-5 text-center shadow-sm">
          <p className="text-3xl mb-2">{scoreEmoji}</p>
          <p className="text-xl font-bold text-indigo-700">{score} out of {questions.length} correct</p>
          <p className="text-sm text-indigo-500 mt-1">{scoreMessage}</p>
        </div>
      )}

      {questions.map((q, qIndex) => {
        const isAnswered = selected[qIndex] !== undefined;
        const isCorrect = selected[qIndex] === q.correct_index;
        return (
          <div key={qIndex} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${isAnswered ? (isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600") : "bg-indigo-100 text-indigo-600"}`}>
                {isAnswered ? (isCorrect ? "✓" : "✗") : qIndex + 1}
              </span>
              <p className="text-sm font-semibold text-gray-800 leading-snug flex-1">{q.question}</p>
            </div>

            <div className="space-y-2 ml-10">
              {q.options.map((opt, oIndex) => (
                <button key={oIndex} onClick={() => handleSelect(qIndex, oIndex)}
                  className={`w-full text-left border rounded-xl px-4 py-2.5 text-sm transition-all duration-150 ${optionStyle(q, qIndex, oIndex)}`}>
                  <span className="font-medium mr-2 text-gray-400">{["A","B","C","D"][oIndex]}.</span>
                  {opt}
                </button>
              ))}
            </div>

            {isAnswered && q.explanation && (
              <div className={`mt-4 ml-10 rounded-xl p-3 text-xs leading-relaxed
                ${isCorrect ? "bg-green-50 border border-green-100 text-green-800" : "bg-amber-50 border border-amber-100 text-amber-800"}`}>
                <span className="font-semibold">{isCorrect ? "✅ Correct! " : "💡 Explanation: "}</span>
                {q.explanation}
              </div>
            )}

            {/* Reference video button — shown after answering */}
            {isAnswered && (
              <button
                onClick={() => setVideoTopic(q.question)}
                className="mt-3 ml-10 text-xs text-indigo-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
              >
                <span>▶</span> Find explanation video
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
