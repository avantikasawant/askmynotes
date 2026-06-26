import { useEffect, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API_URL = import.meta.env.VITE_API_URL;

function StatCard({ label, value, sub, color = "indigo" }) {
  const colors = {
    indigo: "from-indigo-500 to-purple-600",
    green: "from-green-400 to-emerald-500",
    orange: "from-orange-400 to-amber-500",
    blue: "from-blue-400 to-cyan-500",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 text-white shadow-md`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1 opacity-90">{label}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/dashboard`)
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return <p className="text-center text-gray-400">Could not load dashboard.</p>;

  // Prepare chart data — score % per attempt
  const chartData = data.quiz_attempts.map((a, i) => ({
    attempt: `#${i + 1}`,
    score: Math.round((a.score / a.total) * 100),
    label: `${a.score}/${a.total}`,
  }));

  const actionIcon = { uploaded: "📄", asked: "💬", registered: "🎉" };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Your Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Quizzes Taken" value={data.total_quizzes} color="indigo" />
        <StatCard label="Avg Score" value={`${data.average_score}%`} color="green" />
        <StatCard label="Questions Asked" value={data.questions_asked} color="blue" />
        <StatCard label="PDFs Uploaded" value={data.pdfs_uploaded} color="orange" />
      </div>

      {/* Quiz score chart */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Quiz Score History</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="attempt" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(val) => [`${val}%`, "Score"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5}
                dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm text-gray-400">No quiz attempts yet — take a quiz to see your progress here.</p>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</p>
        {data.recent_activity.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-lg">{actionIcon[a.action] || "•"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 capitalize">{a.action}</p>
                  {a.detail && <p className="text-[11px] text-gray-400 truncate">{a.detail}</p>}
                </div>
                <p className="text-[11px] text-gray-300 shrink-0">
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
