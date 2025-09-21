// src/pages/NotFound.jsx
import { Link } from "react-router-dom";

export default function NotFound(){
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-black flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="text-8xl font-black text-slate-300 dark:text-slate-700 tracking-tight">404</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Страница не найдена</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Похоже, вы перешли по неверной ссылке или страница была перемещена.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2.5 font-medium shadow hover:bg-indigo-700 transition"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h9.586L11.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
