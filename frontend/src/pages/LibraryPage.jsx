import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "Z"); // SQLite stores UTC without Z
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function LibraryPage({ onRefresh }) {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFile, setExpandedFile] = useState(null);
  const [deletingFile, setDeletingFile] = useState(null);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/library`);
      setPdfs(res.data.pdfs || []);
    } catch {
      setPdfs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLibrary(); }, []);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete "${filename}" permanently? This cannot be undone.`)) return;
    setDeletingFile(filename);
    try {
      await axios.delete(`${API_URL}/library/${encodeURIComponent(filename)}`);
      setPdfs(prev => prev.filter(p => p.filename !== filename));
      onRefresh?.();
    } finally {
      setDeletingFile(null);
    }
  };

  const handleView = (cloudUrl) => {
    window.open(cloudUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Library</h2>
          <p className="text-sm mt-1 text-slate-500">
            {pdfs.length} PDF{pdfs.length !== 1 ? "s" : ""} — stored permanently, available anytime
          </p>
        </div>
        <button onClick={fetchLibrary}
          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 transition">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pdfs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium text-slate-600">No PDFs in your library yet</p>
          <p className="text-sm mt-1 text-slate-400">Upload a PDF to get started — it'll stay here permanently.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pdfs.map(pdf => (
            <div key={pdf.filename} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg shrink-0">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate">{pdf.filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatSize(pdf.size_bytes)} · {pdf.chunks_indexed} chunks indexed
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleView(pdf.cloud_url)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                    View PDF
                  </button>
                  <button onClick={() => setExpandedFile(expandedFile === pdf.filename ? null : pdf.filename)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition">
                    Details
                  </button>
                  <button onClick={() => handleDelete(pdf.filename)} disabled={deletingFile === pdf.filename}
                    className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50">
                    {deletingFile === pdf.filename ? "..." : "Delete"}
                  </button>
                </div>
              </div>

              {expandedFile === pdf.filename && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-50 bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                    <div>
                      <p className="text-slate-400">Uploaded</p>
                      <p className="font-medium text-slate-700 mt-0.5">{formatDate(pdf.uploaded_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">File Size</p>
                      <p className="font-medium text-slate-700 mt-0.5">{formatSize(pdf.size_bytes)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Chunks Indexed</p>
                      <p className="font-medium text-slate-700 mt-0.5">{pdf.chunks_indexed}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Storage</p>
                      <p className="font-medium text-slate-700 mt-0.5">Permanent (Cloud)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-600">
        💡 PDFs in your library are stored permanently and stay available even after logging out. They're only removed when you delete them.
      </div>
    </div>
  );
}
