import { useState, useEffect } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  return { toasts, addToast };
}

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fadeIn
            ${t.type === "success" ? "bg-green-500" :
              t.type === "error" ? "bg-red-500" : "bg-indigo-500"}`}>
          {t.type === "success" ? "✅ " : t.type === "error" ? "❌ " : "ℹ️ "}
          {t.message}
        </div>
      ))}
    </div>
  );
}
