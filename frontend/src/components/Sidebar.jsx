import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { id: "home",         icon: "🏠", label: "Home" },
  { id: "upload",       icon: "📤", label: "Upload Notes" },
  { id: "library",      icon: "📂", label: "My Library" },
  { id: "qna",          icon: "💬", label: "Ask AI" },
  { id: "quiz",         icon: "🧠", label: "Take Quiz" },
  { id: "studyguide",   icon: "🗺️", label: "Study Guide" },
  { id: "dashboard",    icon: "📊", label: "Dashboard" },
];

const NAV_BOTTOM = [
  { id: "public-library", icon: "📚", label: "Notes Library" },
  { id: "profile",        icon: "👤", label: "Profile" },
];

export default function Sidebar({ active, setActive, collapsed, setCollapsed }) {
  const { dark, toggle } = useTheme();
  const { user } = useAuth();

  const initials = user?.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";

  const navBtn = (item) => (
    <button
      key={item.id}
      onClick={() => setActive(item.id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150
        ${active === item.id
          ? "bg-indigo-600 text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-800"}
        ${collapsed ? "justify-center px-0" : ""}`}
      title={collapsed ? item.label : ""}
    >
      <span className="text-base shrink-0">{item.icon}</span>
      {!collapsed && <span className="animate-fadeIn">{item.label}</span>}
      {!collapsed && active === item.id && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
      )}
    </button>
  );

  return (
    <aside
      className={`sidebar-transition flex flex-col h-screen fixed left-0 top-0 z-20
        bg-slate-900 border-r border-slate-800
        ${collapsed ? "w-16" : "w-60"}`}
    >
      {/* Logo + collapse button */}
      <div className={`flex items-center h-16 px-4 border-b border-slate-800 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black">AN</div>
            <span className="text-white font-bold text-sm">AskMyNotes</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-4 mb-2">Study Tools</p>
        )}
        {NAV.map(navBtn)}

        <div className={`mt-3 pt-3 border-t border-slate-800 ${!collapsed ? "" : ""}`}>
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-4 mb-2">Community</p>
          )}
          {NAV_BOTTOM.map(navBtn)}
        </div>
      </nav>

      {/* Bottom: theme toggle + user */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        <button
          onClick={toggle}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
            text-slate-400 hover:text-white hover:bg-slate-800 ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? (dark ? "Light mode" : "Dark mode") : ""}
        >
          <span>{dark ? "☀️" : "🌙"}</span>
          {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.name}</p>
              <p className="text-slate-500 text-[10px] truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
