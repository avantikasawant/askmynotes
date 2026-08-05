import { useTheme } from "../context/ThemeContext";

export default function LandingPage({ onLogin, onGoToLibrary }) {
  const { dark, toggle } = useTheme();

  const features = [
    { icon: "🧠", title: "AI-Powered Q&A", desc: "Ask any question about your notes and get precise answers with page-level citations" },
    { icon: "📚", title: "Notes Library", desc: "Browse and download notes shared by fellow students — filtered by stream, course and semester" },
    { icon: "🧩", title: "Smart Quizzes", desc: "Auto-generated MCQ quizzes from your material with difficulty levels and score tracking" },
    { icon: "🗺️", title: "Study Guide", desc: "AI-generated topic priority breakdown so you know exactly what to focus on" },
    { icon: "▶️", title: "YouTube Resources", desc: "Relevant video recommendations for every topic in your notes" },
    { icon: "📊", title: "Dashboard", desc: "Track your quiz scores, questions asked and study activity over time" },
  ];

  const steps = [
    { num: "01", title: "Upload Your Notes", desc: "PDF, Word, PowerPoint or plain text — up to 20MB" },
    { num: "02", title: "AI Indexes Them", desc: "Chunked, embedded and stored in your private vector store" },
    { num: "03", title: "Learn Smarter", desc: "Ask questions, take quizzes, get study guides — all grounded in your notes" },
  ];

  const bg = dark
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950"
    : "bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50";

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-300`}>
      {/* Nav */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b ${dark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-gray-100"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow">AN</div>
            <span className={`font-bold text-base ${dark ? "text-white" : "text-slate-900"}`}>AskMyNotes</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onGoToLibrary}
              className={`hidden sm:inline-flex text-sm font-medium px-3 py-1.5 rounded-lg transition ${dark ? "text-slate-300 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
            >
              Notes Library
            </button>
            <button
              onClick={toggle}
              className={`text-xl p-1.5 rounded-lg transition ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
              title="Toggle theme"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              onClick={onLogin}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow hover:opacity-90 transition"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border
          ${dark ? "bg-indigo-900/40 border-indigo-700 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600"}`}>
          ✨ AI-Powered Study Assistant
        </div>
        <h1 className={`text-4xl sm:text-6xl font-black leading-tight mb-6 ${dark ? "text-white" : "text-slate-900"}`}>
          Study smarter<br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
            not harder
          </span>
        </h1>
        <p className={`text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed ${dark ? "text-slate-400" : "text-slate-600"}`}>
          Upload your lecture notes and get instant AI answers, auto-generated quizzes, study guides and YouTube resources — all grounded in your own material.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onLogin}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-base shadow-xl hover:opacity-90 transition hover:scale-105"
          >
            Start for free →
          </button>
          <button
            onClick={onGoToLibrary}
            className={`px-8 py-3.5 rounded-2xl font-bold text-base border transition hover:scale-105
              ${dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-gray-200 text-slate-700 hover:bg-white shadow"}`}
          >
            📚 Browse Notes Library
          </button>
        </div>

        {/* Tech badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {["Llama 3.1 · Groq", "FastEmbed", "ChromaDB", "Hybrid RAG", "FastAPI", "Cloudinary"].map(b => (
            <span key={b} className={`text-xs px-3 py-1 rounded-full border font-medium
              ${dark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-gray-200 text-slate-500 shadow-sm"}`}>
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <p className={`text-xs font-bold uppercase tracking-widest text-center mb-2 ${dark ? "text-slate-500" : "text-slate-400"}`}>Features</p>
        <h2 className={`text-3xl font-black text-center mb-10 ${dark ? "text-white" : "text-slate-900"}`}>
          Everything you need to ace your exams
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title}
              className={`rounded-2xl p-6 border transition hover:scale-[1.02] hover:shadow-lg
                ${dark ? "bg-slate-800/60 border-slate-700 hover:border-indigo-600" : "bg-white border-gray-100 shadow-sm hover:border-indigo-200"}`}>
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className={`font-bold text-sm mb-1.5 ${dark ? "text-white" : "text-slate-900"}`}>{f.title}</h3>
              <p className={`text-xs leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className={`py-16 border-y ${dark ? "border-slate-800 bg-slate-900/40" : "border-gray-100 bg-white/60"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className={`text-xs font-bold uppercase tracking-widest text-center mb-2 ${dark ? "text-slate-500" : "text-slate-400"}`}>How it works</p>
          <h2 className={`text-3xl font-black text-center mb-10 ${dark ? "text-white" : "text-slate-900"}`}>Three steps to study mastery</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < steps.length - 1 && (
                  <div className={`hidden sm:block absolute top-8 left-[60%] w-full h-px ${dark ? "bg-slate-700" : "bg-gray-200"}`} />
                )}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black mx-auto mb-4 shadow-lg
                  bg-gradient-to-br from-indigo-500 to-purple-600 text-white`}>
                  {s.num}
                </div>
                <h3 className={`font-bold text-sm mb-1.5 ${dark ? "text-white" : "text-slate-900"}`}>{s.title}</h3>
                <p className={`text-xs leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className={`text-3xl sm:text-4xl font-black mb-4 ${dark ? "text-white" : "text-slate-900"}`}>
          Ready to study smarter?
        </h2>
        <p className={`mb-8 ${dark ? "text-slate-400" : "text-slate-500"}`}>Free to use · No credit card required · Start in 30 seconds</p>
        <button
          onClick={onLogin}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg shadow-2xl hover:opacity-90 transition hover:scale-105"
        >
          Get started for free →
        </button>
      </section>

      {/* Footer */}
      <footer className={`border-t py-6 text-center text-xs ${dark ? "border-slate-800 text-slate-600" : "border-gray-100 text-slate-400"}`}>
        AskMyNotes · FastEmbed · Groq Llama 3.1 · ChromaDB · FastAPI · Cloudinary
      </footer>
    </div>
  );
}
