// src/pages/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { isValidEmail } from "../utils/validation.js";

export default function Login(){
  const { login, loading } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || "/";

  const canSubmit = u.trim().length > 0 && p.length > 0;

  async function onSubmit(e){
    e.preventDefault();
    setErr("");

    // если пользователь вводит email — чуть более дружелюбная ошибка при кривом email
    if (u.includes("@") && !isValidEmail(u)) {
      setErr("Проверьте email — похоже на опечатку.");
      return;
    }

    const res = await login(u, p);
    if (res.ok) nav(from, { replace:true });
    else setErr(res.error || "Не удалось войти");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 p-6 md:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-indigo-600/90 text-white grid place-items-center shadow">
              <svg viewBox="0 0 24 24" className="h-6 w-6"><path fill="currentColor" d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3Zm0 2.236L6 8v8l6 3.236L18 16V8l-6-2.764Z"/></svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Вход в систему</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Добро пожаловать 👋</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Логин или email</label>
              <input
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                value={u}
                onChange={e=>setU(e.target.value)}
                placeholder="user или you@example.com"
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-slate-600 dark:text-slate-300">Пароль</label>
                <button
                  type="button"
                  onClick={()=>setShowPw(v=>!v)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {showPw ? "Скрыть" : "Показать"}
                </button>
              </div>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 pr-10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                  type={showPw ? "text" : "password"}
                  value={p}
                  onChange={e=>setP(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4Z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7Zm14.542 0a5 5 0 10-10 0 5 5 0 0010 0Z" clipRule="evenodd"/></svg>
                </div>
              </div>
            </div>

            {err && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-3 py-2">
                {err}
              </div>
            )}

            <button
              disabled={loading || !canSubmit}
              className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium shadow hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "Вход…" : "Войти"}
            </button>

            <div className="text-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">Нет аккаунта? </span>
              <Link to="/register" className="text-indigo-600 hover:underline">Создать аккаунт</Link>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
          Защищено. Используйте корпоративные реквизиты доступа.
        </p>
      </div>
    </div>
  );
}
