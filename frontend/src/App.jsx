import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
import Upload from "./components/Upload";
import QnA from "./components/QnA";
import Quiz from "./components/Quiz";

const API_URL = import.meta.env.VITE_API_URL;

const TABS = [
  { id: "upload",    label: "📄 Upload",    desc: "Index PDFs" },
  { id: "qna",       label: "💬 Ask",       desc: "Chat with notes" },
  { id: "quiz",      label: "🧠 Quiz",      desc: "Test yourself" },
  { id: "dashboard", label: "📊 Dashboard", desc: "Your progress" },
  { id: "profile",   label: "👤 Profile",   desc: "Account" },
];

export default function App() {
  const { user, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("upload");
  const [indexedFiles, setIndexedFiles] = useState([]);

  const refreshFiles = async () => {
    try {
      const res = await axios.get(`${API_URL}/files`);
      setIndexedFiles(res.data.files || []);
    } catch {
      setIndexedFiles([]);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all indexed notes? This cannot be undone.")) return;
    await axios.delete(`${API_URL}/files`);
    setIndexedFiles([]);
  };

  useEffect(() => {
    if (user) refreshFiles();
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <LoginPage />;

  const initials = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-indigo-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow">
              AN
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">AskMyNotes</h1>
              <p className="text-[10px] text-gray-400">RAG-powered study assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {indexedFiles.length > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                  {indexedFiles.length} PDF{indexedFiles.length > 1 ? "s" : ""} indexed
                </span>
                <button onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-full px-2.5 py-0.5 transition-colors">
                  Clear
                </button>
              </div>
            )}
            {/* Avatar */}
            <button onClick={() => setActiveTab("profile")}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow hover:opacity-90 transition">
              {initials}
            </button>
          </div>
        </div>
      </header>

      {/* Indexed files pills */}
      {indexedFiles.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 pt-3 flex flex-wrap gap-2">
          {indexedFiles.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 shadow-sm">
              <span className="text-indigo-400">📄</span> {f}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-6 pt-4">
        <div className="flex gap-1.5 bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white p-1.5 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-2.5 px-3 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap flex-1 min-w-0
                ${activeTab === tab.id
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}>
              <span>{tab.label}</span>
              <span className={`text-[9px] mt-0.5 ${activeTab === tab.id ? "text-indigo-200" : "text-gray-400"}`}>
                {tab.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {activeTab === "upload"    && <Upload onUploadSuccess={() => { refreshFiles(); setActiveTab("qna"); }} />}
        {activeTab === "qna"       && <QnA />}
        {activeTab === "quiz"      && <Quiz />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "profile"   && <ProfilePage />}
      </main>

      <footer className="text-center py-6 text-[10px] text-gray-300">
        AskMyNotes · HuggingFace Embeddings · Groq Llama 3.1 · ChromaDB · FastAPI
      </footer>
    </div>
  );
}
