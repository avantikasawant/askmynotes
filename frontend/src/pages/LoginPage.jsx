import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1 ml-1">{msg}</p>;
}

// ── Forgot Password Modal (2-step) ────────────────────────────────────────────
function ForgotPasswordModal({ dark, onClose }) {
  const [step, setStep] = useState(1);          // 1 = enter email, 2 = enter OTP + new pw
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");     // shown when email service not configured
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const card = dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200";
  const inp = `w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition
    ${dark ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500"
           : "bg-white border-gray-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400"}`;

  const handleRequestOTP = async () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address"); return;
    }
    setError(""); setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      // Dev fallback: backend returns OTP in response when email not configured
      if (res.data.dev_otp) {
        setDevOtp(res.data.dev_otp);
      }
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (!otp.trim()) { setError("Enter the reset code"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        email, otp, new_password: newPassword,
      });
      setSuccess("✅ Password reset! You can now sign in with your new password.");
      setTimeout(onClose, 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 ${card}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className={`font-bold text-lg ${dark ? "text-white" : "text-slate-900"}`}>
              {step === 1 ? "🔑 Forgot Password" : "🔐 Reset Password"}
            </h3>
            <p className={`text-xs mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>
              {step === 1
                ? "Enter your email to receive a reset code"
                : `Enter the 6-digit code sent to ${email}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
              step >= s ? "bg-indigo-500" : dark ? "bg-slate-700" : "bg-gray-200"
            }`} />
          ))}
        </div>

        {success ? (
          <div className={`rounded-xl p-4 text-sm text-center border
            ${dark ? "bg-green-900/30 border-green-700 text-green-300"
                   : "bg-green-50 border-green-200 text-green-700"}`}>
            {success}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Step 1 — Email */}
            {step === 1 && (
              <>
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleRequestOTP()}
                    className={inp}
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button onClick={handleRequestOTP} disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50 hover:opacity-90 transition">
                  {loading ? "Sending..." : "Send Reset Code →"}
                </button>
              </>
            )}

            {/* Step 2 — OTP + New Password */}
            {step === 2 && (
              <>
                {/* Dev OTP notice */}
                {devOtp && (
                  <div className={`rounded-xl p-3 border text-xs text-center
                    ${dark ? "bg-amber-900/30 border-amber-700 text-amber-300"
                           : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                    <p className="font-semibold mb-1">📧 Email service not configured</p>
                    <p>Your reset code is: <span className="font-mono font-black text-base tracking-widest">{devOtp}</span></p>
                  </div>
                )}
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    className={`${inp} text-center tracking-widest font-mono text-lg`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                    className={inp}
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setStep(1); setError(""); }}
                    className={`flex-1 border rounded-xl py-2.5 text-sm font-medium transition
                      ${dark ? "border-slate-600 text-slate-400 hover:bg-slate-700"
                             : "border-gray-200 text-slate-500 hover:bg-gray-50"}`}>
                    ← Back
                  </button>
                  <button onClick={handleResetPassword} disabled={loading}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50 hover:opacity-90 transition">
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </>
            )}

            {/* Code expired? Resend */}
            {step === 2 && !devOtp && (
              <button onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className={`w-full text-xs text-center mt-1 transition
                  ${dark ? "text-slate-500 hover:text-indigo-400" : "text-slate-400 hover:text-indigo-500"}`}>
                Didn't receive the code? Send again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────────────────────────
export default function LoginPage({ onSuccess, onBack }) {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", mobile: "" });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showForgot, setShowForgot] = useState(false);

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

  const switchMode = (m) => {
    setMode(m);
    setErrors({});
    setGlobalError("");
    setSuccessMsg("");
  };

  // Theme helpers
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
      {/* Forgot password modal */}
      {showForgot && <ForgotPasswordModal dark={dark} onClose={() => setShowForgot(false)} />}

      <div className="w-full max-w-sm">
        {/* Back + theme */}
        <div className="flex items-center justify-between mb-6">
          {onBack && (
            <button onClick={onBack}
              className={`text-sm flex items-center gap-1 transition ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>
              ← Back
            </button>
          )}
          <button onClick={toggle}
            className={`ml-auto text-sm transition ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black mx-auto mb-3">
            AN
          </div>
          <h1 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>AskMyNotes</h1>
          <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>Your AI-powered study companion</p>
        </div>

        <div className={`rounded-2xl border p-6 ${cardBg}`}>
          {/* Tabs */}
          <div className={`flex rounded-xl p-1 mb-5 ${tabBg}`}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? activeTab : inactiveTab}`}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <input placeholder="Full name" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className={errors.name ? inputError : inputNormal} />
                <FieldError msg={errors.name} />
              </div>
            )}
            <div>
              <input type="email" placeholder="Email address" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className={errors.email ? inputError : inputNormal} />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <input type="password" placeholder="Password" value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
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

          {/* Forgot password link */}
          {mode === "login" && (
            <div className="text-right mt-2">
              <button onClick={() => setShowForgot(true)}
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
        </div>

        <p className={`text-center text-xs mt-6 ${dark ? "text-slate-600" : "text-slate-400"}`}>
          AskMyNotes · RAG-powered · Groq Llama 3.1 · HuggingFace
        </p>
      </div>
    </div>
  );
}
