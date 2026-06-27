import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import { useToast, ToastContainer } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import StudyGuidePage from "./pages/StudyGuidePage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
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

  const handleClearAll = async () => {
    if (!window.confirm("Clear all indexed notes?")) return;
    await axios.delete(`${API_URL}/files`);
    setIndexedFiles([]);
    addToast("All notes cleared", "success");
  };

  useEffect(() => { if (user) refreshFiles(); }, [user]);

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${dark ? "bg-slate-900" : "bg-slate-50"}`}>
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <LoginPage onSuccess={(msg) => addToast(msg, "success")} />
  );

  const sidebarWidth = collapsed ? 64 : 240;

  const pageProps = {
    home:       <HomePage setActive={setActive} indexedFiles={indexedFiles} />,
    upload:     <Upload onUploadSuccess={() => { refreshFiles(); addToast("PDF indexed!", "success"); setActive("qna"); }} indexedFiles={indexedFiles} />,
    library:    <LibraryPage indexedFiles={indexedFiles} onClear={handleClearAll} />,
    qna:        <QnA />,
    quiz:       <Quiz onScoreSaved={() => addToast("Score saved!", "success")} />,
    studyguide: <StudyGuidePage />,
    dashboard:  <DashboardPage />,
    profile:    <ProfilePage onSaved={() => addToast("Profile updated!", "success")} onLogout={() => { logout(); addToast("Logged out", "success"); }} />,
  };

  return (
    <div className={`flex h-screen overflow-hidden ${dark ? "bg-slate-900" : "bg-slate-50"}`}>
      <ToastContainer toasts={toasts} />

      <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main content */}
      <main
        className={`flex-1 overflow-y-auto transition-all duration-300`}
        style={{ marginLeft: sidebarWidth }}
      >
        {/* Top bar */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b
          ${dark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/90 border-slate-200"} backdrop-blur`}>
          <div>
            <h1 className={`text-base font-bold capitalize ${dark ? "text-white" : "text-slate-900"}`}>
              {active === "qna" ? "Ask Questions" : active === "studyguide" ? "Study Guide" : active}
            </h1>
            {indexedFiles.length > 0 && (
              <p className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                {indexedFiles.length} PDF{indexedFiles.length > 1 ? "s" : ""} indexed
              </p>
            )}
          </div>

          {/* Mobile sidebar toggle */}
          <button onClick={() => setCollapsed(!collapsed)}
            className={`sm:hidden p-2 rounded-lg ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}>
            ☰
          </button>
        </div>

        <div className="p-6">
          {pageProps[active] || pageProps.home}
        </div>
      </main>
    </div>
  );
}
