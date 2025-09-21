// src/pages/Register.jsx
import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api/client.js";
import { setSession } from "../api/auth.js";
import { isValidEmail, passwordAnalysis, passwordStrengthLabel } from "../utils/validation.js";

export default function Register(){
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const nav = useNavigate();

  const pwInfo = useMemo(()=>passwordAnalysis(password), [password]);
  const emailOk = isValidEmail(email);
  const usernameOk = username.trim().length >= 3;

  const canSubmit = usernameOk && emailOk && pwInfo.ok;

  async function onSubmit(e){
    e.preventDefault();
    setErr(""); setLoading(true);
    try{
      if (!usernameOk) throw new Error("Имя пользователя: минимум 3 символа.");
      if (!emailOk) throw new Error("Проверьте email — похоже на опечатку.");
      if (!pwInfo.ok) throw new Error("Пароль не соответствует требованиям.");

      const res = await apiFetch("/auth/register", {
        method:"POST",
        body: { username, email, password }
      });
      setSession({ username: res.user.username, token: res.token });
      nav("/", { replace:true });
    }catch(e){
      setErr(e.message || "Ошибка регистрации");
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-black flex items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 p-6 md:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-indigo-600/90 text-white grid place-items-center shadow">
              <svg viewBox="0 0 24 24" className="h-6 w-6"><path fill="currentColor" d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3Z"/></svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Регистрация</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Создайте учётную запись</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Имя пользователя</label>
              <input
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                value={username}
                onChange={e=>setUsername(e.target.value)}
                placeholder="минимум 3 символа"
                autoComplete="username"
              />
              {!usernameOk && username.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Минимум 3 символа.</div>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {email.length > 0 && !emailOk && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Неверный формат email.</div>
              )}
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
              <input
                type={showPw ? "text" : "password"}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="Минимум 8 символов, буквы A-z, цифры и спецсимволы"
                autoComplete="new-password"
              />

              {/* Индикатор прочности */}
              <div className="mt-2">
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      pwInfo.score <= 1 ? "bg-red-500 w-1/5" :
                      pwInfo.score === 2 ? "bg-orange-500 w-2/5" :
                      pwInfo.score === 3 ? "bg-yellow-500 w-3/5" :
                      pwInfo.score === 4 ? "bg-emerald-500 w-4/5" :
                      "bg-emerald-600 w-full"
                    }`}
                  />
                </div>
                <div className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                  Сила пароля: <span className="font-medium">{passwordStrengthLabel(pwInfo.score)}</span>
                </div>
                {!!pwInfo.issues.length && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                    {pwInfo.issues.map((t, i)=>(<li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{t}</span>
                    </li>))}
                  </ul>
                )}
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
              {loading ? "Создаём…" : "Создать аккаунт"}
            </button>

            <div className="text-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">Уже есть аккаунт? </span>
              <Link to="/login" className="text-indigo-600 hover:underline">Войти</Link>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
          Регистрируясь, вы соглашаетесь с правилами использования.
        </p>
      </div>
    </div>
  );
}
