import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function ProfilePage({ onSaved, onLogout }) {
  const { user, logout } = useAuth();
  const { dark } = useTheme();
  const [form, setForm] = useState({ name: "", mobile: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const card = `rounded-2xl border p-6 ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;
  const input = `w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors
    ${dark ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:border-indigo-500"
      : "bg-white border-gray-200 text-slate-800 focus:border-indigo-400"}`;

  useEffect(() => {
    axios.get(`${API_URL}/auth/me`).then(res => setForm({ name: res.data.name, mobile: res.data.mobile || "" }));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/auth/profile`, { ...form, email: user.email });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally { setLoading(false); }
  };

  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fadeIn">
      <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Profile</h2>

      <div className={`${card} flex items-center gap-4`}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          {initials}
        </div>
        <div>
          <p className={`text-lg font-bold ${dark ? "text-white" : "text-slate-900"}`}>{user?.name}</p>
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>{user?.email}</p>
          <span className={`inline-block mt-1 text-xs rounded-full px-2 py-0.5 border
            ${dark ? "bg-indigo-900/40 border-indigo-700 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600"}`}>
            Active Student
          </span>
        </div>
      </div>

      <div className={card}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? "text-slate-500" : "text-slate-400"}`}>Edit Profile</p>
        <div className="space-y-3">
          <div>
            <label className={`text-xs mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} />
          </div>
          <div>
            <label className={`text-xs mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>Email (cannot change)</label>
            <input value={user?.email} disabled
              className={`${input} ${dark ? "opacity-40" : "bg-slate-50 text-slate-400"}`} />
          </div>
          <div>
            <label className={`text-xs mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>Mobile Number</label>
            <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })}
              placeholder="+91 XXXXX XXXXX" className={input} />
          </div>
        </div>
        <button onClick={handleSave} disabled={loading}
          className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-md">
          {saved ? "✅ Saved!" : loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className={card}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>Account</p>
        <div className={`space-y-2 text-sm ${dark ? "text-slate-300" : "text-slate-700"}`}>
          <div className="flex justify-between">
            <span className={dark ? "text-slate-500" : "text-slate-400"}>Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className={dark ? "text-slate-500" : "text-slate-400"}>Plan</span>
            <span className="text-indigo-500 font-medium">Free</span>
          </div>
        </div>
        <button onClick={() => { logout(); onLogout?.(); }}
          className={`mt-5 w-full border rounded-xl py-2.5 text-sm font-medium transition
            ${dark ? "border-red-800 text-red-400 hover:bg-red-900/20" : "border-red-200 text-red-400 hover:bg-red-50"}`}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
