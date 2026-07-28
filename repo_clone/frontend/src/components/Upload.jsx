import { useState, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const MAX_TOTAL_MB = 20;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload({ onUploadSuccess, indexedFiles = [] }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalMB = totalSize / (1024 * 1024);
  const overLimit = totalMB > MAX_TOTAL_MB;
  const duplicates = files.filter(f => indexedFiles.includes(f.name)).map(f => f.name);

  const addFiles = (incoming) => {
    const pdfs = Array.from(incoming).filter(f => f.name.endsWith(".pdf"));
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...pdfs.filter(f => !existing.has(f.name))];
    });
    setResults([]);
  };

  const removeFile = (name) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleUpload = async () => {
    if (!files.length || overLimit) return;
    setLoading(true);
    setResults([]);
    try {
      if (files.length === 1) {
        const formData = new FormData();
        formData.append("file", files[0]);
        const res = await axios.post(`${API_URL}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 180000,
        });
        setResults([{ filename: res.data.filename, status: "success", chunks_indexed: res.data.chunks_indexed }]);
      } else {
        const formData = new FormData();
        files.forEach(f => formData.append("files", f));
        const res = await axios.post(`${API_URL}/upload/multiple`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 300000,
        });
        setResults(res.data.results || []);
      }
      setFiles([]);
      setTimeout(() => onUploadSuccess?.(), 1500);
    } catch (err) {
      setResults([{ filename: "Upload", status: "error", message: err.response?.data?.detail || "Upload failed. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const successCount = results.filter(r => r.status === "success").length;
  const hasErrors = results.some(r => r.status === "error");

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Upload PDFs</h2>
        <p className="text-sm mt-1 text-slate-500">Upload one or multiple lecture notes at once (max {MAX_TOTAL_MB}MB total). They're stored permanently in your library.</p>
      </div>

      {!results.length && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => !loading && inputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
            ${dragOver ? "border-indigo-500 bg-indigo-50 scale-[1.01]" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30"}`}
        >
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
            onChange={(e) => addFiles(e.target.files)} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-indigo-600">Processing and indexing...</p>
              <p className="text-xs text-slate-400">This may take 1-2 minutes</p>
            </div>
          ) : files.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">📄</span>
              <p className="text-sm font-medium text-slate-700">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
              <p className="text-xs text-slate-400">{formatSize(totalSize)} total</p>
              <p className="text-xs text-indigo-500 hover:underline">+ Add more files</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">☁️</span>
              <p className="text-sm font-medium text-slate-600">
                Drag & drop PDFs, or <span className="text-indigo-500 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400">Multiple files supported · Max {MAX_TOTAL_MB}MB total</p>
            </div>
          )}
        </div>
      )}

      {files.length > 0 && !results.length && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Files to Upload</p>
            <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${overLimit ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
              {formatSize(totalSize)} / {MAX_TOTAL_MB}MB
            </div>
          </div>
          {files.map(f => (
            <div key={f.name} className={`flex items-center gap-3 p-2.5 rounded-xl border
              ${duplicates.includes(f.name) ? "border-amber-200 bg-amber-50" : "border-gray-100"}`}>
              <span className="text-lg">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{f.name}</p>
                <p className="text-[10px] text-slate-400">{formatSize(f.size)}
                  {duplicates.includes(f.name) && <span className="text-amber-600 ml-1">· already in library</span>}
                </p>
              </div>
              <button onClick={() => removeFile(f.name)} className="text-slate-300 hover:text-red-400 transition text-lg shrink-0">×</button>
            </div>
          ))}
          {overLimit && <p className="text-xs text-red-500 text-center pt-1">⚠️ Total size exceeds {MAX_TOTAL_MB}MB. Remove some files.</p>}
        </div>
      )}

      {files.length > 0 && !loading && !results.length && (
        <button onClick={handleUpload} disabled={overLimit}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-3.5 font-bold hover:opacity-90 disabled:opacity-50 transition shadow-lg">
          Upload {files.length} File{files.length > 1 ? "s" : ""} & Index →
        </button>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          {successCount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-green-700">✅ {successCount} file{successCount > 1 ? "s" : ""} indexed and saved to library</p>
              <p className="text-xs text-green-500 mt-0.5">Redirecting...</p>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl p-3 text-xs border
              ${r.status === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
              <span className="font-medium">{r.status === "success" ? "✅" : "❌"} {r.filename}</span>
              {r.status === "success" && <span className="ml-2 text-green-500">{r.chunks_indexed} chunks</span>}
              {r.status === "error" && <span className="ml-2">{r.message}</span>}
            </div>
          ))}
          {hasErrors && (
            <button onClick={() => { setResults([]); setFiles([]); }}
              className="w-full border border-red-200 text-red-500 hover:bg-red-50 rounded-xl py-2.5 text-sm font-medium transition">
              Try Again
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">How it works</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "📑", step: "Parse", desc: "PDF → text per page" },
            { icon: "🔢", step: "Embed", desc: "Chunks → vectors" },
            { icon: "☁️", step: "Store", desc: "Saved to your library" },
          ].map(s => (
            <div key={s.step} className="flex flex-col items-center gap-1.5">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-xs font-semibold text-slate-700">{s.step}</p>
              <p className="text-[11px] text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
