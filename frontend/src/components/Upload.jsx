import { useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;
const MAX_TOTAL_MB = 20;

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const ACCEPT_ATTR = ".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

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

function isSupported(filename) {
  const ext = "." + filename.split(".").pop().toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export default function Upload({ onUploadSuccess, indexedFiles = [] }) {
  const { user } = useAuth();
  const { dark } = useTheme();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState("idle");

  // Sharing metadata
  const [isPublic, setIsPublic] = useState(false);
  const [stream, setStream] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");

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

    try {
      const endpoint = files.length === 1 ? "/upload" : "/upload/multiple";
      const formData = new FormData();

      if (files.length === 1) {
        formData.append("file", files[0]);
      } else {
        files.forEach(f => formData.append("files", f));
      }

      // Append sharing metadata
      formData.append("is_public", isPublic);
      formData.append("stream", stream);
      formData.append("course", course);
      formData.append("semester", semester);
      formData.append("subject", subject);

      const res = await axios.post(`${API_URL}${endpoint}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${user?.token}`,
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
      if (files.length === 1) {
        setResults([{ filename: res.data.filename, status: "success" }]);
      } else {
        setResults(
          (res.data.results || []).map(r => ({
            filename: r.filename,
            status: r.status === "processing" ? "success" : r.status,
            message: r.message,
          }))
        );
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

  // Theme helpers
  const card = `rounded-2xl border ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;
  const selectCls = `w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition
    ${dark ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-gray-200 text-slate-700"}`;
  const labelCls = `text-xs font-semibold mb-1.5 block ${dark ? "text-slate-400" : "text-slate-500"}`;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>Upload Notes</h2>
        <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Upload lecture notes — PDF, Word, PowerPoint, or plain text (max {MAX_TOTAL_MB}MB total).
        </p>
        <div className="flex gap-2 mt-2 flex-wrap">
          {[["📄","PDF"],["📝","DOCX"],["📊","PPTX"],["📃","TXT"]].map(([icon, label]) => (
            <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border
              ${dark ? "bg-indigo-900/30 border-indigo-800 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-600"}`}>
              {icon} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!results.length && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => !loading && inputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
            ${dragOver
              ? "border-indigo-500 bg-indigo-50/20 scale-[1.01]"
              : dark
                ? "border-slate-700 hover:border-indigo-500 hover:bg-indigo-900/10"
                : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30"}`}
        >
          <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden"
            onChange={(e) => addFiles(e.target.files)} />

          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className={stage === "uploading" ? "text-indigo-500" : "text-slate-400"}>
                    {stage === "uploading" ? `Uploading… ${uploadProgress}%` : "Uploaded ✓"}
                  </span>
                  <span className={stage === "indexing" ? "text-purple-500 animate-pulse" : "text-slate-400"}>
                    {stage === "indexing" ? "Indexing…" : "Indexing"}
                  </span>
                </div>
                <div className={`w-full rounded-full h-2.5 overflow-hidden ${dark ? "bg-slate-700" : "bg-gray-100"}`}>
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
              <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {stage === "uploading" && "Sending file to server…"}
                {stage === "indexing" && "Creating embeddings — this may take 1-2 minutes"}
              </p>
            </div>
          ) : files.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">{files.length === 1 ? getFileIcon(files[0].name) : "📚"}</span>
              <p className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-700"}`}>
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
              <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{formatSize(totalSize)} total</p>
              <p className="text-xs text-indigo-500 hover:underline">+ Add more files</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">☁️</span>
              <p className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-600"}`}>
                Drag & drop files, or <span className="text-indigo-500 underline">browse</span>
              </p>
              <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>PDF · DOCX · PPTX · TXT · Max {MAX_TOTAL_MB}MB total</p>
            </div>
          )}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && !results.length && (
        <div className={`${card} p-4 space-y-2`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-semibold uppercase tracking-widest ${dark ? "text-slate-500" : "text-slate-400"}`}>Files to Upload</p>
            <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${overLimit
              ? "bg-red-100 text-red-600"
              : dark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"}`}>
              {formatSize(totalSize)} / {MAX_TOTAL_MB}MB
            </div>
          </div>
          {files.map(f => (
            <div key={f.name} className={`flex items-center gap-3 p-2.5 rounded-xl border
              ${duplicates.includes(f.name)
                ? dark ? "border-amber-800 bg-amber-900/20" : "border-amber-200 bg-amber-50"
                : dark ? "border-slate-700" : "border-gray-100"}`}>
              <span className="text-lg">{getFileIcon(f.name)}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-700"}`}>{f.name}</p>
                <p className={`text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  {f.name.split(".").pop().toUpperCase()} · {formatSize(f.size)}
                  {duplicates.includes(f.name) && <span className="text-amber-500 ml-1">· already in library</span>}
                </p>
              </div>
              {!loading && (
                <button onClick={() => removeFile(f.name)} className="text-slate-400 hover:text-red-400 transition text-lg shrink-0">×</button>
              )}
            </div>
          ))}
          {overLimit && <p className="text-xs text-red-500 text-center pt-1">⚠️ Total size exceeds {MAX_TOTAL_MB}MB. Remove some files.</p>}
        </div>
      )}

      {/* Sharing metadata — shown when files are selected */}
      {files.length > 0 && !loading && !results.length && (
        <div className={`${card} p-5 space-y-4`}>
          {/* Public toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Share publicly</p>
              <p className={`text-xs mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                Add to the Notes Library so others can download it
              </p>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? "bg-indigo-500" : dark ? "bg-slate-600" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPublic ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          {/* Metadata fields — only relevant if public */}
          {isPublic && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-slate-600/30">
              <p className={`col-span-2 text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                Help others find your notes by adding details:
              </p>
              <div>
                <label className={labelCls}>Stream</label>
                <select value={stream} onChange={e => { setStream(e.target.value); setCourse(""); }} className={selectCls}>
                  {STREAMS.map(s => <option key={s} value={s}>{s || "Select stream"}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Course</label>
                <select value={course} onChange={e => setCourse(e.target.value)} className={selectCls} disabled={!stream}>
                  <option value="">Select course</option>
                  {(COURSES[stream] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Semester</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} className={selectCls}>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s || "Select semester"}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Subject / Topic</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Thermodynamics"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition
                    ${dark ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:border-indigo-500"
                      : "bg-white border-gray-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400"}`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && !loading && !results.length && (
        <button onClick={handleUpload} disabled={overLimit}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl py-3.5 font-bold hover:opacity-90 disabled:opacity-50 transition shadow-lg">
          Upload {files.length} File{files.length > 1 ? "s" : ""} & Index →
          {isPublic && <span className="ml-2 text-xs font-normal opacity-80">(will appear in library)</span>}
        </button>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className={`${card} p-5 space-y-3`}>
          {successCount > 0 && (
            <div className={`border rounded-xl p-3 text-center
              ${dark ? "bg-green-900/20 border-green-800 text-green-300" : "bg-green-50 border-green-200 text-green-700"}`}>
              <p className="text-sm font-semibold">✅ {successCount} file{successCount > 1 ? "s" : ""} indexed successfully</p>
              {isPublic && <p className="text-xs mt-0.5 opacity-80">Uploading to library in background…</p>}
              <p className="text-xs mt-0.5 opacity-70">Redirecting…</p>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl p-3 text-xs border
              ${r.status === "success"
                ? dark ? "bg-green-900/20 border-green-800 text-green-300" : "bg-green-50 border-green-200 text-green-700"
                : dark ? "bg-red-900/20 border-red-800 text-red-300" : "bg-red-50 border-red-200 text-red-600"}`}>
              <span className="font-medium">{r.status === "success" ? "✅" : "❌"} {r.filename}</span>
              {r.status === "error" && <span className="ml-2">{r.message}</span>}
            </div>
          ))}
          {hasErrors && (
            <button onClick={() => { setResults([]); setFiles([]); setStage("idle"); }}
              className={`w-full border rounded-xl py-2.5 text-sm font-medium transition
                ${dark ? "border-red-800 text-red-400 hover:bg-red-900/20" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
              Try Again
            </button>
          )}
        </div>
      )}

      {/* How it works */}
      <div className={`${card} p-5`}>
        <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? "text-slate-500" : "text-slate-400"}`}>How it works</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: "📑", step: "Parse", desc: "Notes → text per page/slide" },
            { icon: "🔢", step: "Embed", desc: "Chunks → your private vectors" },
            { icon: "☁️", step: "Store", desc: "Saved to your library" },
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
