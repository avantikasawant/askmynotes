import { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

const STREAMS = ["", "Science", "Commerce", "Arts", "Engineering", "Medical", "Law", "Management"];
const COURSES = {
  "": [],
  Science: ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science"],
  Commerce: ["Accountancy", "Business Studies", "Economics", "Statistics"],
  Arts: ["History", "Political Science", "Geography", "Sociology", "Psychology"],
  Engineering: ["Data Structures", "Algorithms", "DBMS", "OS", "Networks", "Machine Learning", "Web Dev"],
  Medical: ["Anatomy", "Physiology", "Biochemistry", "Pharmacology", "Pathology"],
  Law: ["Constitutional Law", "Criminal Law", "Contract Law", "Civil Law"],
  Management: ["Marketing", "Finance", "HR", "Operations", "Strategy"],
};
const SEMESTERS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getFileIcon(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📄";
  if (ext === "docx") return "📝";
  if (ext === "pptx") return "📊";
  return "📃";
}

export default function PublicLibraryPage({ onLogin, onBack }) {
  const { dark, toggle } = useTheme();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stream, setStream] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");

  const fetchNotes = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_URL}/public/notes`, {
        params: { stream, course, semester, search: search.trim() },
      });
      setNotes(res.data.notes || []);
    } catch {
      setError("Failed to load notes. The server may be starting up — try again in a moment.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleStreamChange = (val) => {
    setStream(val);
    setCourse(""); // reset course when stream changes
  };

  const handleApply = () => fetchNotes();

  const bg = dark
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950"
    : "bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50";

  const card = `rounded-2xl border ${dark ? "bg-slate-800/60 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;
  const select = `w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition
    ${dark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-200 text-slate-700"}`;
  const label = `text-xs font-semibold mb-1.5 block ${dark ? "text-slate-400" : "text-slate-500"}`;

  return (
    <div className={`min-h-screen ${bg} transition-colors`}>
      {/* Nav */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b ${dark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-gray-100"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className={`text-sm font-medium transition ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}>
              ← Home
            </button>
            <span className={`text-slate-400`}>|</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black">AN</div>
              <span className={`font-bold text-sm ${dark ? "text-white" : "text-slate-900"}`}>Notes Library</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className={`text-xl p-1.5 rounded-lg transition ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              onClick={onLogin}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow hover:opacity-90 transition"
            >
              Login / Sign up
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className={`text-3xl font-black ${dark ? "text-white" : "text-slate-900"}`}>Notes Library</h1>
          <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
            Community-shared notes — browse, filter and download
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters sidebar */}
          <aside className="lg:w-64 shrink-0 space-y-4">
            <div className={`${card} p-5 space-y-4`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"}`}>Filters</p>

              {/* Search */}
              <div>
                <label className={label}>Search</label>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleApply()}
                  placeholder="Search notes..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition
                    ${dark ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:border-indigo-500"
                      : "bg-white border-gray-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400"}`}
                />
              </div>

              {/* Stream */}
              <div>
                <label className={label}>Stream</label>
                <select value={stream} onChange={e => handleStreamChange(e.target.value)} className={select}>
                  {STREAMS.map(s => <option key={s} value={s}>{s || "All Streams"}</option>)}
                </select>
              </div>

              {/* Course */}
              <div>
                <label className={label}>Course / Subject</label>
                <select value={course} onChange={e => setCourse(e.target.value)} className={select}>
                  <option value="">All Courses</option>
                  {(COURSES[stream] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className={label}>Semester</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} className={select}>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s || "All Semesters"}</option>)}
                </select>
              </div>

              <button onClick={handleApply}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:opacity-90 transition shadow">
                Apply Filters
              </button>

              {(stream || course || semester || search) && (
                <button onClick={() => { setStream(""); setCourse(""); setSemester(""); setSearch(""); fetchNotes(); }}
                  className={`w-full text-sm py-2 rounded-xl border transition
                    ${dark ? "border-slate-700 text-slate-400 hover:text-white" : "border-gray-200 text-slate-500 hover:text-slate-700"}`}>
                  Clear filters
                </button>
              )}
            </div>

            {/* Upload CTA */}
            <div className={`${card} p-5 text-center`}>
              <p className="text-2xl mb-2">📤</p>
              <p className={`text-sm font-semibold mb-1 ${dark ? "text-white" : "text-slate-800"}`}>Share your notes</p>
              <p className={`text-xs mb-3 ${dark ? "text-slate-400" : "text-slate-500"}`}>Upload and help your peers study</p>
              <button onClick={onLogin}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-2 font-semibold text-sm hover:opacity-90 transition">
                Upload Notes
              </button>
            </div>
          </aside>

          {/* Notes grid */}
          <main className="flex-1">
            {error && (
              <div className={`rounded-2xl border p-4 mb-4 text-sm ${dark ? "bg-red-900/20 border-red-800 text-red-300" : "bg-red-50 border-red-200 text-red-600"}`}>
                ⚠️ {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className={`${card} p-16 text-center`}>
                <p className="text-5xl mb-4">📭</p>
                <p className={`text-lg font-semibold mb-2 ${dark ? "text-slate-300" : "text-slate-700"}`}>No notes found</p>
                <p className={`text-sm ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  {stream || course || semester || search
                    ? "Try adjusting your filters"
                    : "Be the first to share notes with the community!"}
                </p>
                <button onClick={onLogin}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition">
                  Upload Notes →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={`text-xs font-medium mb-3 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  {notes.length} note{notes.length !== 1 ? "s" : ""} found
                </p>
                {notes.map(note => (
                  <div key={note.id} className={`${card} p-4 flex items-center gap-4 hover:scale-[1.005] transition`}>
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0
                      ${dark ? "bg-indigo-900/40" : "bg-indigo-50"}`}>
                      {getFileIcon(note.filename)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${dark ? "text-white" : "text-slate-900"}`}>
                        {note.subject || note.filename.replace(/\.[^.]+$/, "")}
                      </p>
                      <p className={`text-xs mt-0.5 truncate ${dark ? "text-slate-400" : "text-slate-500"}`}>
                        {note.filename}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {note.stream && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
                            ${dark ? "bg-indigo-900/30 border-indigo-800 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600"}`}>
                            {note.stream}
                          </span>
                        )}
                        {note.course && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
                            ${dark ? "bg-purple-900/30 border-purple-800 text-purple-300" : "bg-purple-50 border-purple-200 text-purple-600"}`}>
                            {note.course}
                          </span>
                        )}
                        {note.semester && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
                            ${dark ? "bg-slate-700 border-slate-600 text-slate-400" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                            Sem {note.semester}
                          </span>
                        )}
                        <span className={`text-[10px] ${dark ? "text-slate-600" : "text-slate-300"}`}>
                          {formatSize(note.size_bytes)} · {note.chunks_indexed} chunks · {formatDate(note.uploaded_at)}
                        </span>
                      </div>
                      {note.uploader_name && (
                        <p className={`text-[10px] mt-1 ${dark ? "text-slate-600" : "text-slate-400"}`}>
                          Shared by {note.uploader_name}
                        </p>
                      )}
                    </div>

                    {/* Download */}
                    <a
                      href={`${API_URL}/public/notes/download/${note.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-xl border transition
                        ${dark
                          ? "border-indigo-700 text-indigo-300 hover:bg-indigo-900/40"
                          : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}
                    >
                      ↓ Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
