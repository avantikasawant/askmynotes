import { useState } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function LibraryPage({ indexedFiles, onClear }) {
  const { dark } = useTheme();
  const [previewFile, setPreviewFile] = useState(null);

  const card = `rounded-2xl border transition-all
    ${dark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100 shadow-sm"}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>My Library</h2>
          <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {indexedFiles.length} PDF{indexedFiles.length !== 1 ? "s" : ""} indexed
          </p>
        </div>
        {indexedFiles.length > 0 && (
          <button onClick={onClear}
            className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-xl px-3 py-1.5 transition-colors">
            Clear All
          </button>
        )}
      </div>

      {indexedFiles.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <p className="text-4xl mb-3">📭</p>
          <p className={`font-medium ${dark ? "text-slate-300" : "text-slate-600"}`}>No PDFs indexed yet</p>
          <p className={`text-sm mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>Upload a PDF to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {indexedFiles.map(f => (
            <div key={f} className={`${card} p-4 flex items-center gap-4`}>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 text-lg shrink-0">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>{f}</p>
                <p className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>Indexed · Ready to use</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setPreviewFile(previewFile === f ? null : f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                    ${previewFile === f
                      ? "bg-indigo-600 text-white"
                      : dark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {previewFile === f ? "Close" : "Preview"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview */}
      {previewFile && (
        <div className={`${card} p-4 animate-fadeIn`}>
          <p className={`text-sm font-semibold mb-3 ${dark ? "text-slate-300" : "text-slate-700"}`}>
            Preview: {previewFile}
          </p>
          <div className={`rounded-xl overflow-hidden border ${dark ? "border-slate-700" : "border-gray-200"}`}>
            <iframe
              src={`${API_URL}/pdf/${encodeURIComponent(previewFile)}`}
              className="w-full"
              style={{ height: "600px" }}
              title={previewFile}
            />
          </div>
          <p className={`text-xs mt-2 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Note: PDF preview requires the file to still be on the server.
          </p>
        </div>
      )}
    </div>
  );
}
