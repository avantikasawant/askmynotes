import { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "Z").toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return dateStr; }
}

export default function LibraryPage({ onRefresh }) {
  const { dark } = useTheme();
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const card = `rounded-2xl border overflow-hidden ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  const fetchLibrary = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_URL}/library`); setPdfs(res.data.pdfs || []); }
    catch { setPdfs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLibrary(); }, []);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete "${filename}" permanently?`)) return;
    setDeleting(filename);
    try {
      await axios.delete(`${API_URL}/library/${encodeURIComponent(filename)}`);
      setPdfs(prev => prev.filter(p => p.filename !== filename));
      onRefresh?.();
    } finally { setDeleting(null); }
  };

  // Build a proper Cloudinary viewer URL
  // Using Google Docs viewer as fallback to ensure cross-browser PDF rendering
  const getViewUrl = (cloudUrl) => {
    // Use Google Docs viewer which can render any publicly accessible PDF
    return `https://docs.google.com/viewer?url=${encodeURIComponent(cloudUrl)}&embedded=true`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>My Library</h2>
          <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {pdfs.length} PDF{pdfs.length !== 1 ? "s" : ""} — stored permanently, available anytime
          </p>
        </div>
        <button onClick={fetchLibrary}
          className={`text-xs border rounded-lg px-3 py-1.5 transition ${dark ? "border-slate-600 text-slate-400 hover:text-white" : "border-indigo-200 text-indigo-500 hover:text-indigo-700"}`}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pdfs.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <p className="text-4xl mb-3">📭</p>
          <p className={`font-medium ${dark ? "text-slate-300" : "text-slate-600"}`}>No PDFs yet</p>
          <p className={`text-sm mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>Upload a PDF — it stays here permanently even after logout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pdfs.map(pdf => (
            <div key={pdf.filename} className={card}>
              <div className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${dark ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}>📄</div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>{pdf.filename}</p>
                  <p className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {formatSize(pdf.size_bytes)} · {pdf.chunks_indexed} chunks · {formatDate(pdf.uploaded_at)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {/* Open directly in new tab — most reliable */}
                  <a href={pdf.cloud_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                    Download / Open
                  </a>
                  {/* View inline via Google Docs viewer */}
                  <button
                    onClick={() => setExpanded(expanded === pdf.filename ? null : pdf.filename)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition
                      ${expanded === pdf.filename
                        ? "bg-indigo-600 text-white"
                        : dark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {expanded === pdf.filename ? "Close Preview" : "Preview"}
                  </button>
                  <button
                    onClick={() => {
                      setExpanded(null);
                      handleDelete(pdf.filename);
                    }}
                    disabled={deleting === pdf.filename}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border disabled:opacity-50
                      ${dark ? "border-red-800 text-red-400 hover:bg-red-900/20" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
                    {deleting === pdf.filename ? "..." : "Delete"}
                  </button>
                </div>
              </div>

              {/* Details row */}
              <div className={`px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t
                ${dark ? "border-slate-700 bg-slate-900/20" : "border-gray-50 bg-slate-50/50"}`}>
                {[
                  { label: "Uploaded", value: formatDate(pdf.uploaded_at) },
                  { label: "Size", value: formatSize(pdf.size_bytes) },
                  { label: "Chunks", value: pdf.chunks_indexed },
                  { label: "Storage", value: "☁️ Cloudinary" },
                ].map(item => (
                  <div key={item.label} className="pt-3">
                    <p className={dark ? "text-slate-500" : "text-slate-400"}>{item.label}</p>
                    <p className={`font-medium mt-0.5 ${dark ? "text-slate-300" : "text-slate-700"}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Inline preview using Google Docs viewer */}
              {expanded === pdf.filename && (
                <div className={`border-t ${dark ? "border-slate-700" : "border-gray-100"}`}>
                  <div className={`px-4 py-2 flex items-center justify-between text-xs ${dark ? "text-slate-400 bg-slate-900/30" : "text-slate-500 bg-slate-50"}`}>
                    <span>Previewing via Google Docs Viewer</span>
                    <a href={pdf.cloud_url} target="_blank" rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300">Open original ↗</a>
                  </div>
                  <iframe
                    src={getViewUrl(pdf.cloud_url)}
                    title={pdf.filename}
                    width="100%"
                    height="600px"
                    className="block"
                    style={{ border: "none" }}
                    allow="autoplay"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={`rounded-2xl p-4 text-xs border ${dark ? "bg-indigo-900/20 border-indigo-800 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-600"}`}>
        💡 PDFs are stored permanently in Cloudinary. Click <strong>Download / Open</strong> to open in a new tab, or <strong>Preview</strong> to view inline. Only removed when you click Delete.
      </div>
    </div>
  );
}
