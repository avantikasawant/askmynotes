import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL;

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1 ml-1">{msg}</p>;
}

export default function LoginPage({ onSuccess }) {
  const { login } = useAuth();
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

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg mx-auto mb-3">AN</div>
          <h1 className="text-2xl font-bold text-white">AskMyNotes</h1>
          <p className="text-sm text-slate-400 mt-1">Your AI-powered study assistant</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8">
          {/* Tab toggle */}
          <div className="flex bg-slate-900 rounded-xl p-1 mb-6">
            {["login", "register"].map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all
                  ${mode === m ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <input placeholder="Full name *" value={form.name}
                  onChange={e => { setForm({...form, name: e.target.value}); setErrors({...errors, name: ""}); }}
                  className={`w-full bg-slate-700 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition
                    ${errors.name ? "border-red-500 focus:border-red-400" : "border-slate-600 focus:border-indigo-500"}`} />
                <FieldError msg={errors.name} />
              </div>
            )}
            <div>
              <input placeholder="Email address *" type="email" value={form.email}
                onChange={e => { setForm({...form, email: e.target.value}); setErrors({...errors, email: ""}); }}
                className={`w-full bg-slate-700 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition
                  ${errors.email ? "border-red-500 focus:border-red-400" : "border-slate-600 focus:border-indigo-500"}`} />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <input placeholder="Password * (min 6 characters)" type="password" value={form.password}
                onChange={e => { setForm({...form, password: e.target.value}); setErrors({...errors, password: ""}); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className={`w-full bg-slate-700 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition
                  ${errors.password ? "border-red-500 focus:border-red-400" : "border-slate-600 focus:border-indigo-500"}`} />
              <FieldError msg={errors.password} />
            </div>
            {mode === "register" && (
              <div>
                <input placeholder="Mobile number (optional)" value={form.mobile}
                  onChange={e => setForm({...form, mobile: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition" />
              </div>
            )}
          </div>

          {/* Forgot password */}
          {mode === "login" && (
            <div className="text-right mt-2">
              <button onClick={() => alert("Password reset via email — feature coming soon!")}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition">
                Forgot password?
              </button>
            </div>
          )}

          {/* Global error */}
          {globalError && (
            <div className="mt-3 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-xs text-red-300 text-center">
              {globalError}
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="mt-3 bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-xs text-green-300 text-center">
              {successMsg}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50 transition">
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">or continue with</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin onSuccess={handleGoogle} onError={() => setGlobalError("Google login failed")}
              shape="rectangular" theme="filled_black" size="large" text="continue_with" />
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          AskMyNotes · RAG-powered · Groq Llama 3.1 · HuggingFace
        </p>
      </div>
    </div>
  );
}
