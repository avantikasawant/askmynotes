import { useState } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function Upload({ onUploadSuccess, indexedFiles = [] }) {
  const { dark } = useTheme();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const isDuplicate = file && indexedFiles.includes(file.name);

  const card = `rounded-2xl border ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  const handleUpload = async (selectedFile) => {
    const f = selectedFile || file;
    if (!f) return;

    const formData = new FormData();
    formData.append("file", f);
    setLoading(true);
    setResult(null);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setResult({ success: true, message: `Indexed ${res.data.chunks_indexed} chunks from "${res.data.filename}"` });
      setTimeout(() => onUploadSuccess?.(), 1500);
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.detail || "Upload failed. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".pdf")) setFile(dropped);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Upload PDF</h2>
        <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Upload your lecture notes to index them for Q&A and quizzes.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("pdf-input").click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
          ${dragOver
            ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
            : dark
              ? "border-slate-600 hover:border-indigo-500 hover:bg-slate-700/50"
              : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30"}`}
      >
        <input id="pdf-input" type="file" accept="application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files[0]; if (f) setFile(f); }} />

        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className={`text-sm font-medium ${dark ? "text-indigo-400" : "text-indigo-600"}`}>Processing and indexing...</p>
            <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Chunking → Embedding → Storing in ChromaDB</p>
            <p className={`text-xs ${dark ? "text-slate-600" : "text-slate-300"}`}>First upload may take 1-2 minutes</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">📄</span>
            <p className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-700"}`}>{file.name}</p>
            <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{(file.size / 1024).toFixed(1)} KB</p>
            {isDuplicate && (
              <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium
                ${dark ? "bg-amber-900/40 border border-amber-700 text-amber-300" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
                ⚠️ This PDF was previously uploaded — re-indexing will add duplicate chunks.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl">☁️</span>
            <p className={`text-sm font-medium ${dark ? "text-slate-400" : "text-slate-600"}`}>
              Drag & drop a PDF, or <span className="text-indigo-500 underline">browse</span>
            </p>
            <p className={`text-xs ${dark ? "text-slate-600" : "text-slate-400"}`}>Only .pdf files supported</p>
          </div>
        )}
      </div>

      {file && !loading && !result && (
        <button onClick={() => handleUpload()}
          className={`w-full rounded-2xl py-3.5 font-bold text-white transition shadow-lg
            ${isDuplicate
              ? "bg-amber-500 hover:bg-amber-600"
              : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"}`}>
          {isDuplicate ? "⚠️ Re-upload Anyway" : "Upload & Index →"}
        </button>
      )}

      {result && (
        <div className={`rounded-2xl p-4 text-sm font-medium text-center border
          ${result.success
            ? dark ? "bg-green-900/30 border-green-700 text-green-300" : "bg-green-50 border-green-200 text-green-700"
            : dark ? "bg-red-900/30 border-red-700 text-red-300" : "bg-red-50 border-red-200 text-red-600"}`}>
          {result.success ? "✅ " : "❌ "}{result.message}
          {result.success && <p className={`text-xs font-normal mt-1 ${dark ? "text-green-500" : "text-green-500"}`}>Redirecting...</p>}
        </div>
      )}

      {/* How it works */}
      <div className={`${card} p-5`}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? "text-slate-500" : "text-slate-400"}`}>How it works</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "📑", step: "Parse", desc: "PDF → text per page" },
            { icon: "🔢", step: "Embed", desc: "Chunks → vectors" },
            { icon: "🗄️", step: "Store", desc: "Vectors → ChromaDB" },
          ].map(s => (
            <div key={s.step} className="flex flex-col items-center gap-1.5">
              <span className="text-2xl">{s.icon}</span>
              <p className={`text-xs font-semibold ${dark ? "text-slate-300" : "text-slate-700"}`}>{s.step}</p>
              <p className={`text-[11px] ${dark ? "text-slate-500" : "text-slate-400"}`}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
