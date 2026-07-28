import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin } from "@react-oauth/google";
import { useToast, ToastContainer } from "../components/Toast";

const API_URL = import.meta.env.VITE_API_URL;

export default function LoginPage({ onSuccess }) {
  const { login } = useAuth();
  const { toasts, addToast } = useToast();
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({ name: "", email: "", password: "", mobile: "" });
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [lastErrorWasPassword, setLastErrorWasPassword] = useState(false);

  const validateBeforeSubmit = () => {
    if (mode === "register" && !form.name.trim()) {
      addToast("Please enter your full name", "error");
      return false;
    }
    if (!form.email.trim()) {
      addToast("Please enter your email address", "error");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      addToast("Please enter a valid email address", "error");
      return false;
    }
    if (!form.password) {
      addToast("Please enter your password", "error");
      return false;
    }
    if (mode === "register" && form.password.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLastErrorWasPassword(false);
    if (!validateBeforeSubmit()) return;
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login"
        ? { email: form.email.trim(), password: form.password }
        : { name: form.name.trim(), email: form.email.trim(), password: form.password, mobile: form.mobile };
      const res = await axios.post(`${API_URL}${endpoint}`, body);
      login(res.data.token, res.data.name, res.data.email);
      onSuccess?.(mode === "login" ? "Welcome back!" : "Account created!");
    } catch (err) {
      const detail = err.response?.data?.detail || "Something went wrong. Please try again.";
      addToast(detail, "error");
      if (mode === "login" && /incorrect password/i.test(detail)) {
        setLastErrorWasPassword(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credentialResponse) => {
    try {
      const res = await axios.post(`${API_URL}/auth/google`, { token: credentialResponse.credential });
      login(res.data.token, res.data.name, res.data.email);
      onSuccess?.("Google login successful!");
    } catch {
      addToast("Google login failed. Please try again.", "error");
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail.trim()) {
      addToast("Please enter your email address", "error");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email: forgotEmail.trim() });
      addToast(res.data.message || "Password reset link sent to your email", "success");
      setShowForgot(false);
      setForgotEmail("");
    } catch (err) {
      addToast(err.response?.data?.detail || "Something went wrong. Please try again.", "error");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <ToastContainer toasts={toasts} />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg mx-auto mb-3">
            AN
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AskMyNotes</h1>
          <p className="text-sm text-gray-400 mt-1">Your AI-powered study assistant</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {showForgot ? (
            <>
              <button onClick={() => setShowForgot(false)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">
                ← Back to sign in
              </button>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-sm text-gray-400 mb-4">Enter your email and we'll send you a reset link.</p>
              <input placeholder="Email address" type="email" value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleForgotSubmit()}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
              <button onClick={handleForgotSubmit} disabled={forgotLoading}
                className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-md">
                {forgotLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </>
          ) : (
            <>
              {/* Tab toggle */}
              <div className="flex bg-gray-50 rounded-xl p-1 mb-6">
                {["login", "register"].map((m) => (
                  <button key={m} onClick={() => { setMode(m); setLastErrorWasPassword(false); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all
                      ${mode === m ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}>
                    {m === "login" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {mode === "register" && (
                  <input placeholder="Full name" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
                )}
                <input placeholder="Email address" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
                <input placeholder="Password" type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
                {mode === "register" && (
                  <input placeholder="Mobile number (optional)" value={form.mobile}
                    onChange={e => setForm({ ...form, mobile: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
                )}
              </div>

              {mode === "login" && (
                <div className="flex justify-end mt-2">
                  <button onClick={() => { setShowForgot(true); setForgotEmail(form.email); }}
                    className={`text-xs font-medium transition ${lastErrorWasPassword ? "text-red-500 hover:text-red-600" : "text-indigo-400 hover:text-indigo-600"}`}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading}
                className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-md">
                {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or continue with</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="flex justify-center">
                <GoogleLogin onSuccess={handleGoogle} onError={() => addToast("Google login failed", "error")}
                  shape="rectangular" theme="outline" size="large" text="continue_with" />
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          AskMyNotes · RAG-powered · Groq Llama 3.1 · HuggingFace
        </p>
      </div>
    </div>
  );
}
