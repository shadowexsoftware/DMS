//src/components/BanButton.jsx

import React, { useState } from "react";

export default function BanButton({ onConfirm, disabled }){
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if(!open){
    return (
      <button
        disabled={disabled}
        onClick={()=>setOpen(true)}
        className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50"
      >
        Заблокировать
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        className="px-2 py-1 border border-slate-200 rounded-md"
        placeholder="Причина (необязательно)"
        value={reason}
        onChange={(e)=>setReason(e.target.value)}
      />
      <button
        disabled={disabled}
        onClick={async()=>{ await onConfirm(reason.trim()); setOpen(false); setReason(""); }}
        className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
      >
        Подтвердить
      </button>
      <button
        disabled={disabled}
        onClick={()=>{ setOpen(false); setReason(""); }}
        className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50"
      >
        Отмена
      </button>
    </div>
  );
}
