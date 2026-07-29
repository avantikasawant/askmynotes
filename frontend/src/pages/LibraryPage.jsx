import { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf")  return "📄";
  if (ext === "docx") return "📝";
  if (ext === "pptx") return "📊";
  if (ext === "txt")  return "📃";
  return "📁";
}

function getFileLabel(filename) {
  return filename.split(".").pop().toUpperCase();
}

export default function LibraryPage({ onRefresh }) {
  const { dark } = useTheme();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const card = `rounded-2xl border ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  const fetchLibrary = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_URL}/library`);
      setFiles(res.data.pdfs || []);
    } catch (err) {
      setError("Failed to load library. Please try again.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLibrary(); }, []);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Remove "${filename}" from your library and index?`)) return;
    setDeleting(filename);
    try {
      await axios.delete(`${API_URL}/library/${encodeURIComponent(filename)}`);
      setFiles(prev => prev.filter(f => f.filename !== filename));
      onRefresh?.();
    } catch {
      alert("Failed to delete. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>My Library</h2>
          <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {files.length} file{files.length !== 1 ? "s" : ""} indexed and ready for Q&amp;A
          </p>
        </div>
        <button onClick={fetchLibrary}
          className={`text-xs border rounded-lg px-3 py-1.5 transition ${dark ? "border-slate-600 text-slate-400 hover:text-white" : "border-indigo-200 text-indigo-500 hover:text-indigo-700"}`}>
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <p className="text-4xl mb-3">📭</p>
          <p className={`font-medium ${dark ? "text-slate-300" : "text-slate-600"}`}>No files indexed yet</p>
          <p className={`text-sm mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Upload notes to start asking questions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map(file => (
            <div key={file.filename} className={`${card} p-4 flex items-center gap-4`}>
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0
                ${dark ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}>
                {getFileIcon(file.filename)}
              </div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                  {file.filename}
                </p>
                <p className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  {getFileLabel(file.filename)} · Indexed ✓
                </p>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(file.filename)}
                disabled={deleting === file.filename}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border disabled:opacity-50 shrink-0
                  ${dark ? "border-red-800 text-red-400 hover:bg-red-900/20" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
                {deleting === file.filename ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info banner */}
      {files.length > 0 && (
        <div className={`rounded-2xl p-4 text-xs border
          ${dark ? "bg-indigo-900/20 border-indigo-800 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-600"}`}>
          💡 All files are indexed together — ask any question in <strong>Q&amp;A</strong> and the AI will search across all of them automatically.
        </div>
      )}
    </div>
  );
}
