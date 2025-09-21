//src/components/Modal.jsx

import React from "react";

export default function Modal({ title, children, onClose }){
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">{title}</h3>
          <button onClick={onClose} className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
