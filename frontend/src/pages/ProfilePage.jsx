import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function ProfilePage({ onSaved, onLogout }) {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ name: "", mobile: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/auth/me`).then(res => {
      setForm({ name: res.data.name, mobile: res.data.mobile || "" });
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/auth/profile`, { ...form, email: user.email });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Avatar card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow">
          {initials}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">{user?.name}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <span className="inline-block mt-1 text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5">
            Active Student
          </span>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4">Edit Profile</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Email (cannot change)</label>
            <input value={user?.email} disabled
              className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mobile Number</label>
            <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
        </div>
        <button onClick={handleSave} disabled={loading}
          className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-md">
          {saved ? "✅ Saved!" : loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-3">Account</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Email</span>
            <span className="text-gray-700">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Plan</span>
            <span className="text-indigo-600 font-medium">Free</span>
          </div>
        </div>
        <button onClick={() => { logout(); onLogout?.(); }}
          className="mt-5 w-full border border-red-200 text-red-400 hover:bg-red-50 rounded-xl py-2.5 text-sm font-medium transition">
          Sign Out
        </button>
      </div>
    </div>
  );
}
