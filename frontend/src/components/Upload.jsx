import { useState, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const MAX_TOTAL_MB = 20;

// Supported file types
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const ACCEPT_ATTR = ".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf")  return "📄";
  if (ext === "docx") return "📝";
  if (ext === "pptx") return "📊";
  if (ext === "txt")  return "📃";
  return "📁";
}

function getFileLabel(filename) {
  const ext = filename.split(".").pop().toUpperCase();
  return ext;
}

function isSupported(filename) {
  const ext = "." + filename.split(".").pop().toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export default function Upload({ onUploadSuccess, indexedFiles = [] }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  // Progress state
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100 (bytes sent)
  const [stage, setStage] = useState("idle"); // idle | uploading | indexing | done

  const inputRef = useRef();

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalMB = totalSize / (1024 * 1024);
  const overLimit = totalMB > MAX_TOTAL_MB;
  const duplicates = files.filter(f => indexedFiles.includes(f.name)).map(f => f.name);

  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(f => isSupported(f.name));
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !existing.has(f.name))];
    });
    setResults([]);
  };

  const removeFile = (name) => setFiles(prev => prev.filter(f => f.name !== name));

  const handleUpload = async () => {
    if (!files.length || overLimit) return;
    setLoading(true);
    setResults([]);
    setUploadProgress(0);
    setStage("uploading");

    const token = localStorage.getItem("amn_token");

    try {
      if (files.length === 1) {
        const formData = new FormData();
        formData.append("file", files[0]);

        const res = await axios.post(`${API_URL}/upload`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
          timeout: 180000,
          onUploadProgress: (e) => {
            if (e.total) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(pct);
              if (pct === 100) setStage("indexing");
            }
          },
        });
        setStage("done");
        setResults([{ filename: res.data.filename, status: "success", chunks_indexed: res.data.chunks_indexed }]);
      } else {
        const formData = new FormData();
        files.forEach(f => formData.append("files", f));

        const res = await axios.post(`${API_URL}/upload/multiple`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
          timeout: 300000,
          onUploadProgress: (e) => {
            if (e.total) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(pct);
              if (pct === 100) setStage("indexing");
            }
          },
        });
        setStage("done");
        setResults(res.data.results || []);
      }

      setFiles([]);
      setTimeout(() => onUploadSuccess?.(), 1500);
    } catch (err) {
      setStage("idle");
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
        <h2 className="text-2xl font-bold text-slate-900">Upload Notes</h2>
        <p className="text-sm mt-1 text-slate-500">
          Upload lecture notes in any format — PDF, Word, PowerPoint, or plain text (max {MAX_TOTAL_MB}MB total).
        </p>
        {/* Supported formats badge row */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {[["📄", "PDF"], ["📝", "DOCX"], ["📊", "PPTX"], ["📃", "TXT"]].map(([icon, label]) => (
            <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold border border-indigo-100">
              {icon} {label}
            </span>
          ))}
        </div>
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
          <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden"
            onChange={(e) => addFiles(e.target.files)} />

          {loading ? (
            <div className="flex flex-col items-center gap-4">
              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className={`${stage === "uploading" ? "text-indigo-600" : "text-slate-400"}`}>
                    {stage === "uploading" ? `Uploading… ${uploadProgress}%` : "Uploaded ✓"}
                  </span>
                  <span className={`${stage === "indexing" ? "text-purple-600 animate-pulse" : "text-slate-300"}`}>
                    {stage === "indexing" ? "Indexing…" : "Indexing"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      stage === "indexing"
                        ? "bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse w-full"
                        : "bg-gradient-to-r from-indigo-500 to-purple-600"
                    }`}
                    style={{ width: stage === "indexing" ? "100%" : `${uploadProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {stage === "uploading" && "Sending file to server…"}
                {stage === "indexing" && "Creating embeddings — this may take 1-2 minutes"}
              </p>
            </div>
          ) : files.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">{files.length === 1 ? getFileIcon(files[0].name) : "📚"}</span>
              <p className="text-sm font-medium text-slate-700">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
              <p className="text-xs text-slate-400">{formatSize(totalSize)} total</p>
              <p className="text-xs text-indigo-500 hover:underline">+ Add more files</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">☁️</span>
              <p className="text-sm font-medium text-slate-600">
                Drag & drop files, or <span className="text-indigo-500 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400">PDF · DOCX · PPTX · TXT · Max {MAX_TOTAL_MB}MB total</p>
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
              <span className="text-lg">{getFileIcon(f.name)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{f.name}</p>
                <p className="text-[10px] text-slate-400">
                  {getFileLabel(f.name)} · {formatSize(f.size)}
                  {duplicates.includes(f.name) && <span className="text-amber-600 ml-1">· already in library</span>}
                </p>
              </div>
              {!loading && (
                <button onClick={() => removeFile(f.name)} className="text-slate-300 hover:text-red-400 transition text-lg shrink-0">×</button>
              )}
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
              <p className="text-xs text-green-500 mt-0.5">Redirecting…</p>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl p-3 text-xs border
              ${r.status === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
              <span className="font-medium">{r.status === "success" ? "✅" : "❌"} {r.filename}</span>
              {r.status === "success" && <span className="ml-2 text-green-500">{r.chunks_indexed} chunks indexed</span>}
              {r.status === "error" && <span className="ml-2">{r.message}</span>}
            </div>
          ))}
          {hasErrors && (
            <button onClick={() => { setResults([]); setFiles([]); setStage("idle"); }}
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
            { icon: "📑", step: "Parse", desc: "Notes → text per page/slide" },
            { icon: "🔢", step: "Embed", desc: "Chunks → your private vectors" },
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
