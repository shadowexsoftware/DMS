//src/pages/admin/UsersTab.jsx
import React, { useMemo, useState } from "react";
import Modal from "../../components/Modal.jsx";
import BanButton from "../../components/BanButton.jsx";
import {
  listUsers, banUser, unbanUser, promoteUser, demoteUser, createUserAdmin
} from "../../api/admin.js";

const ENABLE_ADMIN_CREATE = false; // включи true, когда добавишь маршрут на бэке

function fmtDate(s){
  if(!s) return "—";
  try{ const d = new Date(s); return d.toLocaleString(); }catch{ return String(s); }
}

export default function UsersTab({ registrationOpen, settingsBusy, onToggleRegistration }){
  // серверная пагинация: limit/offset; total нет → определяем по длине items
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // клиентский поиск по username/email (сервер пока не поддерживает search)
  const [q, setQ] = useState("");

  const filtered = useMemo(()=>{
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(u =>
      String(u.username||"").toLowerCase().includes(needle) ||
      String(u.email||"").toLowerCase().includes(needle)
    );
  }, [items, q]);

  async function load(){
    setBusy(true); setErr("");
    try{
      const js = await listUsers({ limit, offset });
      const arr = js?.items ?? js?.data?.items ?? [];
      setItems(Array.isArray(arr) ? arr : []);
    }catch(e){
      setErr(`Ошибка загрузки: ${e?.message || e}`);
    }finally{ setBusy(false); }
  }

  // создание пользователя (через /admin/users/create)
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", is_admin: false });

  async function doCreate(){
    if (!ENABLE_ADMIN_CREATE) { alert("Маршрут создания на бэке не включён."); return; }
    setBusy(true); setErr("");
    try{
      await createUserAdmin(form);
      setShowCreate(false);
      setForm({ username: "", email: "", password: "", is_admin: false });
      setOffset(0);
      await load();
    }catch(e){
      setErr(`Ошибка регистрации: ${e?.message || e}`);
    }finally{ setBusy(false); }
  }

  async function doBan(id){
    setBusy(true); setErr("");
    try{ await banUser(id); await load(); }
    catch(e){ setErr(`Ошибка блокировки: ${e?.message || e}`); }
    finally{ setBusy(false); }
  }
  async function doUnban(id){
    setBusy(true); setErr("");
    try{ await unbanUser(id); await load(); }
    catch(e){ setErr(`Ошибка разблокировки: ${e?.message || e}`); }
    finally{ setBusy(false); }
  }
  async function doPromote(id){
    setBusy(true); setErr("");
    try{ await promoteUser(id); await load(); }
    catch(e){ setErr(`Ошибка повышения: ${e?.message || e}`); }
    finally{ setBusy(false); }
  }
  async function doDemote(id){
    setBusy(true); setErr("");
    try{ await demoteUser(id); await load(); }
    catch(e){ setErr(`Ошибка понижения: ${e?.message || e}`); }
    finally{ setBusy(false); }
  }

  // признаки для пагинации: следующая страница доступна, если items.length === limit
  const hasPrev = offset > 0;
  const hasNext = items.length === limit;

  return (
    <section className="space-y-4">
      {err && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-3 py-2">
          {err}
        </div>
      )}

      {/* Тумблер регистрации */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">Регистрация пользователей</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Выключи, если нужно временно заблокировать публичную регистрацию. Из админки создавать всё равно можно.
          </div>
        </div>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={registrationOpen}
            disabled={settingsBusy}
            onChange={(e)=>onToggleRegistration(e.target.checked)}
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            {registrationOpen ? "Открыта" : "Закрыта"}
          </span>
        </label>
      </div>

      {/* Поиск и создание */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Поиск (username/email)…"
          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg min-w-[260px]
                     bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                     placeholder-slate-400 dark:placeholder-slate-500"
        />
        <button
          onClick={()=>load()}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          disabled={busy}
        >
          Обновить
        </button>
        <div className="flex-1" />
        {ENABLE_ADMIN_CREATE && (
          <button
            onClick={()=>setShowCreate(true)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                       bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                       hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            + Создать пользователя
          </button>
        )}
      </div>

      {/* Таблица */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr className="text-left">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Роль</th>
              <th className="px-3 py-2">Создан</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {busy && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">Загрузка…</td>
              </tr>
            )}
            {!busy && filtered.map(u=>(
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-700/60">
                <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{u.id}</td>
                <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{u.username || "—"}</td>
                <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{u.email || "—"}</td>
                <td className="px-3 py-2">
                  {u.is_admin
                    ? <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">admin</span>
                    : <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">user</span>
                  }
                </td>
                <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{fmtDate(u.created_at)}</td>
                <td className="px-3 py-2">
                  {u.is_active
                    ? <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">активен</span>
                    : <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">заблокирован</span>
                  }
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {u.is_admin ? (
                      <button
                        onClick={()=>doDemote(u.id)}
                        disabled={busy}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700
                                   bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                                   hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Снять admin
                      </button>
                    ) : (
                      <button
                        onClick={()=>doPromote(u.id)}
                        disabled={busy}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700
                                   bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                                   hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Сделать admin
                      </button>
                    )}

                    {u.is_active ? (
                      <BanButton onConfirm={()=>doBan(u.id)} disabled={busy} />
                    ) : (
                      <button
                        onClick={()=>doUnban(u.id)}
                        disabled={busy}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700
                                   bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                                   hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Разблокировать
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!busy && !filtered.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">— нет результатов —</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация limit/offset */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Показаны записи {offset}–{offset + filtered.length} (limit {limit})
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg
                       bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            value={limit}
            onChange={(e)=>{ const v = Number(e.target.value)||20; if (v !== limit){ setLimit(v); setOffset(0); load(); } }}
          >
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n} на странице</option>)}
          </select>
          <button
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50
                       bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                       hover:bg-slate-50 dark:hover:bg-slate-800"
            disabled={!hasPrev}
            onClick={()=>{ const next = Math.max(0, offset - limit); setOffset(next); load(); }}
          >
            Назад
          </button>
          <button
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50
                       bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                       hover:bg-slate-50 dark:hover:bg-slate-800"
            disabled={!hasNext}
            onClick={()=>{ const next = offset + limit; setOffset(next); load(); }}
          >
            Вперёд
          </button>
        </div>
      </div>

      {/* Модалка создания пользователя (по флагу) */}
      {ENABLE_ADMIN_CREATE && showCreate && (
        <Modal onClose={()=>setShowCreate(false)} title="Создать пользователя">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Username</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg
                           bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={form.username}
                onChange={(e)=>setForm({...form, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg
                           bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={form.email}
                onChange={(e)=>setForm({...form, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Пароль</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg
                           bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={form.password}
                onChange={(e)=>setForm({...form, password: e.target.value})}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.is_admin}
                onChange={(e)=>setForm({...form, is_admin: e.target.checked})}
              />
              <span className="text-sm">Сделать admin</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                           bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
                           hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={()=>setShowCreate(false)}
              >
                Отмена
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={doCreate}
                disabled={busy}
              >
                Создать
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
