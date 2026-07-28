import { useEffect, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function DashboardPage() {
  const { dark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/dashboard`).then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  const card = `rounded-2xl border p-5 ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return <p className={`text-center ${dark ? "text-slate-400" : "text-slate-500"}`}>Could not load dashboard.</p>;

  const chartData = data.quiz_attempts.map((a, i) => ({
    attempt: `#${i + 1}`,
    score: Math.round((a.score / a.total) * 100),
  }));

  const stats = [
    { label: "Quizzes", value: data.total_quizzes, icon: "🧠", color: "from-indigo-500 to-purple-600" },
    { label: "Avg Score", value: `${data.average_score}%`, icon: "📈", color: "from-green-500 to-emerald-500" },
    { label: "Questions", value: data.questions_asked, icon: "💬", color: "from-blue-500 to-cyan-500" },
    { label: "PDFs", value: data.pdfs_uploaded, icon: "📄", color: "from-amber-500 to-orange-500" },
  ];

  const actionIcon = { uploaded: "📄", asked: "💬", registered: "🎉" };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fadeIn">
      <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Dashboard</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white shadow-md`}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs opacity-80 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {chartData.length > 0 ? (
        <div className={card}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Quiz Score History
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1E293B" : "#F1F5F9"} />
              <XAxis dataKey="attempt" tick={{ fontSize: 11, fill: dark ? "#64748B" : "#94A3B8" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: dark ? "#64748B" : "#94A3B8" }} unit="%" />
              <Tooltip
                formatter={(val) => [`${val}%`, "Score"]}
                contentStyle={{
                  borderRadius: 12,
                  border: dark ? "1px solid #334155" : "1px solid #E2E8F0",
                  background: dark ? "#1E293B" : "#FFFFFF",
                  color: dark ? "#F1F5F9" : "#0F172A",
                  fontSize: 12
                }}
              />
              <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2.5}
                dot={{ fill: "#6366F1", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={`${card} text-center py-10`}>
          <p className="text-3xl mb-2">📊</p>
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>No quiz attempts yet.</p>
        </div>
      )}

      <div className={card}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>Recent Activity</p>
        {data.recent_activity.length === 0 ? (
          <p className={`text-xs text-center py-4 ${dark ? "text-slate-500" : "text-slate-400"}`}>No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.slice(0, 8).map((a, i) => (
              <div key={i} className={`flex items-center gap-3 py-2 border-b last:border-0
                ${dark ? "border-slate-700" : "border-gray-50"}`}>
                <span className="text-lg">{actionIcon[a.action] || "•"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium capitalize ${dark ? "text-slate-300" : "text-slate-700"}`}>{a.action}</p>
                  {a.detail && <p className={`text-[11px] truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>{a.detail}</p>}
                </div>
                <p className={`text-[11px] shrink-0 ${dark ? "text-slate-600" : "text-slate-300"}`}>
                  {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
