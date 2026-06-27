import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import axios from "axios";
import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function HomePage({ setActive, indexedFiles }) {
  const { user } = useAuth();
  const { dark } = useTheme();
  const firstName = user?.name?.split(" ")[0] || "there";

  const card = `rounded-2xl border p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
    ${dark ? "bg-slate-800 border-slate-700 hover:border-indigo-500" : "bg-white border-gray-100 hover:border-indigo-300 shadow-sm"}`;

  const actions = [
    { icon: "📄", label: "Upload PDF", desc: "Add new lecture notes", id: "upload", color: "from-indigo-500 to-purple-600" },
    { icon: "💬", label: "Ask Questions", desc: "Chat with your notes", id: "qna", color: "from-blue-500 to-cyan-500" },
    { icon: "🧠", label: "Take a Test", desc: "Quiz yourself", id: "quiz", color: "from-amber-500 to-orange-500" },
    { icon: "🗺️", label: "Study Guide", desc: "Topics to focus on", id: "studyguide", color: "from-green-500 to-emerald-500" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      {/* Greeting */}
      <div>
        <h1 className={`text-3xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {firstName} 👋
        </h1>
        <p className={`mt-1 text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
          {indexedFiles.length === 0
            ? "Upload your first PDF to get started."
            : `You have ${indexedFiles.length} PDF${indexedFiles.length > 1 ? "s" : ""} indexed and ready.`}
        </p>
      </div>

      {/* Quick actions */}
      <div>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map(a => (
            <button key={a.id} onClick={() => setActive(a.id)} className={card}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-xl mb-3`}>
                {a.icon}
              </div>
              <p className={`font-semibold text-sm ${dark ? "text-white" : "text-slate-800"}`}>{a.label}</p>
              <p className={`text-xs mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Indexed PDFs */}
      {indexedFiles.length > 0 && (
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>Indexed PDFs</p>
          <div className="space-y-2">
            {indexedFiles.map(f => (
              <div key={f} onClick={() => setActive("library")}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors
                  ${dark ? "bg-slate-800 hover:bg-slate-700 border border-slate-700" : "bg-white hover:bg-indigo-50 border border-gray-100 shadow-sm"}`}>
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm shrink-0">📄</div>
                <p className={`text-sm font-medium truncate ${dark ? "text-slate-200" : "text-slate-700"}`}>{f}</p>
                <span className={`ml-auto text-xs shrink-0 ${dark ? "text-slate-500" : "text-slate-400"}`}>View →</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
