import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL;

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1 ml-1">{msg}</p>;
}

export default function LoginPage({ onSuccess, onBack }) {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", mobile: "" });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const validate = () => {
    const e = {};
    if (mode === "register" && !form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    return e;
  };

  const handleSubmit = async () => {
    setGlobalError(""); setSuccessMsg("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, mobile: form.mobile };
      const res = await axios.post(`${API_URL}${endpoint}`, body);
      setSuccessMsg(mode === "login" ? "✅ Login successful! Redirecting..." : "✅ Account created! Redirecting...");
      onSuccess?.(mode === "login" ? "Welcome back!" : "Account created!");
      setTimeout(() => login(res.data.token, res.data.name, res.data.email), 1000);
    } catch (err) {
      const detail = err.response?.data?.detail || "";
      if (detail.toLowerCase().includes("email already")) {
        setErrors({ email: "This email is already registered. Try signing in." });
      } else if (detail.toLowerCase().includes("invalid email or password")) {
        setGlobalError("Incorrect email or password. Please try again.");
        setErrors({ password: "Incorrect password" });
      } else if (detail.toLowerCase().includes("not found") || detail.toLowerCase().includes("invalid")) {
        setGlobalError("No account found with this email. Please create an account.");
      } else {
        setGlobalError(detail || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credentialResponse) => {
    setGlobalError(""); setSuccessMsg("");
    try {
      const res = await axios.post(`${API_URL}/auth/google`, { token: credentialResponse.credential });
      setSuccessMsg("✅ Google login successful! Redirecting...");
      onSuccess?.("Google login successful!");
      setTimeout(() => login(res.data.token, res.data.name, res.data.email), 1000);
    } catch { setGlobalError("Google login failed. Try again."); }
  };

  const switchMode = (m) => {
    setMode(m);
    setErrors({});
    setGlobalError("");
    setSuccessMsg("");
  };

  // Theme-aware style helpers
  const bg = dark
    ? "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center px-4"
    : "min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4";

  const cardBg = dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200 shadow-xl";
  const tabBg = dark ? "bg-slate-900" : "bg-slate-100";
  const activeTab = dark ? "bg-slate-700 text-white shadow" : "bg-white text-slate-800 shadow";
  const inactiveTab = dark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700";
  const inputBase = "w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition";
  const inputNormal = dark
    ? `${inputBase} bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500`
    : `${inputBase} bg-white border-gray-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400`;
  const inputError = dark
    ? `${inputBase} bg-slate-700 border-red-500 text-white placeholder-slate-400 focus:border-red-400`
    : `${inputBase} bg-white border-red-400 text-slate-800 placeholder-slate-400`;

  return (
    <div className={bg}>
      {/* Theme toggle top-right */}
      <button onClick={toggle}
        className={`fixed top-4 right-4 text-xl p-2 rounded-xl transition ${dark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-slate-800 shadow"}`}>
        {dark ? "☀️" : "🌙"}
      </button>

      {/* Back to home */}
      {onBack && (
        <button onClick={onBack}
          className={`fixed top-4 left-4 text-sm font-medium px-3 py-2 rounded-xl transition ${dark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-800 hover:bg-white shadow"}`}>
          ← Home
        </button>
      )}

      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-xl mx-auto mb-3">AN</div>
          <h1 className={`text-2xl font-black ${dark ? "text-white" : "text-slate-900"}`}>AskMyNotes</h1>
          <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>Your AI-powered study assistant</p>
        </div>

        <div className={`rounded-2xl border p-8 ${cardBg}`}>
          {/* Tab toggle */}
          <div className={`flex ${tabBg} rounded-xl p-1 mb-6`}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all
                  ${mode === m ? activeTab : inactiveTab}`}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <input placeholder="Full name *" value={form.name}
                  onChange={e => { setForm({...form, name: e.target.value}); setErrors({...errors, name: ""}); }}
                  className={errors.name ? inputError : inputNormal} />
                <FieldError msg={errors.name} />
              </div>
            )}
            <div>
              <input placeholder="Email address *" type="email" value={form.email}
                onChange={e => { setForm({...form, email: e.target.value}); setErrors({...errors, email: ""}); }}
                className={errors.email ? inputError : inputNormal} />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <input placeholder="Password * (min 6 characters)" type="password" value={form.password}
                onChange={e => { setForm({...form, password: e.target.value}); setErrors({...errors, password: ""}); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className={errors.password ? inputError : inputNormal} />
              <FieldError msg={errors.password} />
            </div>
            {mode === "register" && (
              <div>
                <input placeholder="Mobile number (optional)" value={form.mobile}
                  onChange={e => setForm({...form, mobile: e.target.value})}
                  className={inputNormal} />
              </div>
            )}
          </div>

          {mode === "login" && (
            <div className="text-right mt-2">
              <button onClick={() => alert("Password reset via email — feature coming soon!")}
                className={`text-xs transition ${dark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-500 hover:text-indigo-700"}`}>
                Forgot password?
              </button>
            </div>
          )}

          {globalError && (
            <div className={`mt-3 border rounded-xl px-4 py-3 text-xs text-center
              ${dark ? "bg-red-900/30 border-red-700 text-red-300" : "bg-red-50 border-red-300 text-red-600"}`}>
              {globalError}
            </div>
          )}
          {successMsg && (
            <div className={`mt-3 border rounded-xl px-4 py-3 text-xs text-center
              ${dark ? "bg-green-900/30 border-green-700 text-green-300" : "bg-green-50 border-green-300 text-green-600"}`}>
              {successMsg}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50 hover:opacity-90 transition shadow-md">
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className={`flex-1 h-px ${dark ? "bg-slate-700" : "bg-gray-200"}`} />
            <span className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>or continue with</span>
            <div className={`flex-1 h-px ${dark ? "bg-slate-700" : "bg-gray-200"}`} />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogle}
              onError={() => setGlobalError("Google login failed")}
              shape="rectangular"
              theme={dark ? "filled_black" : "outline"}
              size="large"
              text="continue_with"
              width="100%"
            />
          </div>
        </div>

        <p className={`text-center text-xs mt-6 ${dark ? "text-slate-600" : "text-slate-400"}`}>
          AskMyNotes · RAG-powered · Groq Llama 3.1 · HuggingFace
        </p>
      </div>
    </div>
  );
}
