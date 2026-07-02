import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import { useToast, ToastContainer } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
import StudyGuidePage from "./pages/StudyGuidePage";
import Upload from "./components/Upload";
import QnA from "./components/QnA";
import Quiz from "./components/Quiz";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const { user, logout, loading } = useAuth();
  const { dark } = useTheme();
  const { toasts, addToast } = useToast();
  const [active, setActive] = useState("home");
  const [collapsed, setCollapsed] = useState(false);
  const [indexedFiles, setIndexedFiles] = useState([]);

  const refreshFiles = async () => {
    try {
      const res = await axios.get(`${API_URL}/files`);
      setIndexedFiles(res.data.files || []);
    } catch { setIndexedFiles([]); }
  };

  useEffect(() => { if (user) refreshFiles(); }, [user]);

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${dark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50"}`}>
      <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <LoginPage onSuccess={(msg) => addToast(msg, "success")} />;

  return (
    <div className={`min-h-screen ${dark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50"}`}>
      <ToastContainer toasts={toasts} />

      <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />

      <main
        className="sidebar-transition px-4 sm:px-8 py-8 transition-all duration-200"
        style={{ marginLeft: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
      >
        {active === "home" && (
          <HomePage setActive={setActive} indexedFiles={indexedFiles} />
        )}
        {active === "upload" && (
          <Upload onUploadSuccess={() => { refreshFiles(); addToast("PDF saved to library!", "success"); setActive("qna"); }} indexedFiles={indexedFiles} />
        )}
        {active === "library" && <LibraryPage onRefresh={refreshFiles} />}
        {active === "qna" && <QnA />}
        {active === "quiz" && <Quiz onScoreSaved={() => addToast("Score saved!", "success")} />}
        {active === "studyguide" && <StudyGuidePage />}
        {active === "dashboard" && <DashboardPage />}
        {active === "profile" && (
          <ProfilePage
            onSaved={() => addToast("Profile updated!", "success")}
            onLogout={() => { logout(); addToast("Logged out", "success"); }}
          />
        )}

        <footer className={`text-center py-6 text-[10px] ${dark ? "text-slate-600" : "text-gray-300"}`}>
          AskMyNotes · FastEmbed · Groq Llama 3.1 · ChromaDB · Cloudinary · FastAPI
        </footer>
      </main>
    </div>
  );
}