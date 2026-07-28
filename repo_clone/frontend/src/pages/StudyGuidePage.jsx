import { useState } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function StudyGuidePage() {
  const { dark } = useTheme();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const card = `rounded-2xl border p-5 ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  const fetchGuide = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_URL}/study-guide`);
      if (res.data.error) setError(res.data.error);
      else setGuide(res.data);
    } catch {
      setError("Failed to generate study guide. Make sure a PDF is uploaded.");
    } finally {
      setLoading(false);
    }
  };

  const priorityColor = {
    high: dark ? "bg-red-900/40 border-red-700 text-red-300" : "bg-red-50 border-red-200 text-red-700",
    medium: dark ? "bg-amber-900/40 border-amber-700 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700",
    low: dark ? "bg-green-900/40 border-green-700 text-green-300" : "bg-green-50 border-green-200 text-green-700",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Study Guide</h2>
        <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Topics to focus on based on your uploaded notes
        </p>
      </div>

      <button onClick={fetchGuide} disabled={loading}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-3.5 font-semibold hover:opacity-90 disabled:opacity-50 transition shadow-md">
        {loading ? "Analysing your notes..." : "🗺️ Generate Study Guide"}
      </button>

      {error && (
        <div className={`rounded-2xl border p-4 text-sm ${dark ? "bg-red-900/20 border-red-800 text-red-300" : "bg-red-50 border-red-200 text-red-600"}`}>
          {error}
        </div>
      )}

      {guide && (
        <div className="space-y-4 animate-slideUp">
          {/* Summary */}
          <div className={card}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${dark ? "text-slate-500" : "text-slate-400"}`}>Document Summary</p>
            <p className={`text-sm leading-relaxed ${dark ? "text-slate-300" : "text-slate-700"}`}>{guide.summary}</p>
          </div>

          {/* Topics */}
          <div className={card}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>
              Topics to Study
            </p>
            <div className="space-y-3">
              {guide.topics?.map((t, i) => (
                <div key={i} className={`rounded-xl border p-3 ${priorityColor[t.priority] || priorityColor.medium}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{t.topic}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border
                      ${priorityColor[t.priority] || priorityColor.medium}`}>
                      {t.priority} priority
                    </span>
                  </div>
                  <p className="text-xs opacity-80">{t.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {guide.study_tips?.length > 0 && (
            <div className={card}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>Study Tips</p>
              <ul className="space-y-2">
                {guide.study_tips.map((tip, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${dark ? "text-slate-300" : "text-slate-700"}`}>
                    <span className="text-indigo-500 shrink-0 mt-0.5">→</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
