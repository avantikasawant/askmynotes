import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function Upload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success, message }
  const [dragOver, setDragOver] = useState(false);

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
      });
      setResult({ success: true, message: `✅ Indexed ${res.data.chunks_indexed} chunks from "${res.data.filename}"` });
      setTimeout(() => onUploadSuccess?.(), 1200);
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
    if (dropped?.name.endsWith(".pdf")) {
      setFile(dropped);
      handleUpload(dropped);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Hero text */}
      <div className="text-center pt-4">
        <h2 className="text-2xl font-bold text-gray-800">Upload Your Lecture Notes</h2>
        <p className="text-sm text-gray-500 mt-1">
          Drop a PDF — we'll chunk it, embed it, and make it answerable.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer
          ${dragOver ? "border-indigo-500 bg-indigo-50 scale-[1.01]" : "border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40"}`}
        onClick={() => document.getElementById("pdf-input").click()}
      >
        <input
          id="pdf-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files[0];
            if (f) { setFile(f); }
          }}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-indigo-600 font-medium">Processing and indexing...</p>
            <p className="text-xs text-gray-400">Chunking → Embedding → Storing in ChromaDB</p>
          </div>
        ) : file && !result ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">📄</span>
            <p className="text-sm font-medium text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl">☁️</span>
            <p className="text-sm font-medium text-gray-600">
              Drag & drop a PDF here, or <span className="text-indigo-600 underline">browse</span>
            </p>
            <p className="text-xs text-gray-400">Only .pdf files supported</p>
          </div>
        )}
      </div>

      {/* Upload button — shows only when file is selected and not yet uploading */}
      {file && !loading && !result && (
        <button
          onClick={() => handleUpload()}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold hover:opacity-90 transition shadow-md"
        >
          Upload & Index →
        </button>
      )}

      {/* Result message */}
      {result && (
        <div className={`rounded-xl p-4 text-sm font-medium text-center ${
          result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {result.message}
          {result.success && <p className="text-xs font-normal mt-1 text-green-500">Redirecting to Ask tab...</p>}
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How it works</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "📑", step: "1. Parse", desc: "PDF → text per page" },
            { icon: "🔢", step: "2. Embed", desc: "Chunks → vectors (MiniLM)" },
            { icon: "🗄️", step: "3. Store", desc: "Vectors → ChromaDB" },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-xs font-semibold text-gray-700">{s.step}</p>
              <p className="text-[11px] text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
