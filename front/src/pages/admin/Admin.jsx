// src/pages/admin/Admin.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UsersTab from "./UsersTab.jsx";
import SystemTab from "./SystemTab.jsx";
import { getRegistrationConfig, setRegistrationConfig } from "../../api/admin.js";

function cx(...xs){ return xs.filter(Boolean).join(" "); }

export default function Admin(){
  const navigate = useNavigate();

  const [tab, setTab] = useState("users"); // users | system
  const [error, setError] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [settingsBusy, setSettingsBusy] = useState(false);

  function goBack(){
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }

  async function loadReg(){
    try{
      const js = await getRegistrationConfig();
      setRegistrationOpen(Boolean(js?.registration_open));
    }catch(e){
      setError(`Ошибка загрузки настроек: ${e?.message || e}`);
    }
  }

  async function toggleRegistration(nextOpen){
    setSettingsBusy(true); setError("");
    try{
      await setRegistrationConfig(!!nextOpen);
      setRegistrationOpen(!!nextOpen);
    }catch(e){
      setError(`Ошибка сохранения настроек: ${e?.message || e}`);
    }finally{ setSettingsBusy(false); }
  }

  useEffect(()=>{ loadReg(); }, []);

  return (
    <div className="p-4 max-w-[1200px] mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                     bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
                     hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          aria-label="Назад"
        >
          {/* иконка-стрелка влево */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5A1 1 0 0110.707 4.707L7.414 8H16a1 1 0 110 2H7.414l3.293 3.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Назад
        </button>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Админка</h1>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-3 py-2">
          {error}
        </div>
      )}

      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-4 bg-white dark:bg-slate-800">
        <button
          className={cx(
            "px-4 py-2 text-sm transition-colors",
            tab==="users"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          )}
          onClick={()=>setTab("users")}
        >
          Пользователи
        </button>
        <button
          className={cx(
            "px-4 py-2 text-sm border-l border-slate-200 dark:border-slate-700 transition-colors",
            tab==="system"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          )}
          onClick={()=>setTab("system")}
        >
          Система
        </button>
      </div>

      {tab==="users" && (
        <UsersTab
          registrationOpen={registrationOpen}
          settingsBusy={settingsBusy}
          onToggleRegistration={toggleRegistration}
        />
      )}

      {tab==="system" && <SystemTab />}
    </div>
  );
}
