// src/pages/admin/SystemTab.jsx
import React, { useEffect, useState } from "react";
import {
  getBotStatus, getBotBearer, getBotCookies, getBotLocalStorage,
  botStart, botStop, botGoto, botClearCookies
} from "../../api/admin.js";
import { getBotConfig, setBotConfig } from "../../api/admin.js";

function Mask({ masked, yes, no }) {
  if (masked) return <span className="text-slate-600">{masked}</span>;
  return <span className="text-slate-500">{(yes ? yes : "есть") || "есть"}</span> ?? <span className="text-slate-400">{no || "нет"}</span>;
}

export default function SystemTab(){
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState(null);
  const [bearer, setBearer] = useState(null);
  const [cookies, setCookies] = useState([]);
  const [ls, setLs] = useState([]);
  const [url, setUrl] = useState("https://fed-dms-web-prod-public-centralasia.chehejia.com/ru-RU/repairList");

  // конфиг бота
  const [cfg, setCfg] = useState({
    access_token_key: "",
    id_token_key: "",
    has_access_token_json: false,
    has_id_token_json: false,
    has_sso_token: false,
    sso_token_masked: "",
  });

  // форма редактирования
  const [form, setForm] = useState({
    access_token_key: "",
    id_token_key: "",
    access_token_json: "", // оставляй пустым, если не хочешь менять
    id_token_json: "",
    sso_token: "",
    apply_now: true,
    reload_after: false,
  });

  async function loadConfig(){
    try{
      const js = await getBotConfig();
      setCfg(js);
      setForm(f => ({
        ...f,
        access_token_key: js?.access_token_key || "",
        id_token_key: js?.id_token_key || "",
        // секреты предзаполнять не будем — покажем пустыми полями
        access_token_json: "",
        id_token_json: "",
        sso_token: "",
      }));
    }catch(e){
      setErr(`Ошибка получения конфига: ${e?.message || e}`);
    }
  }

  async function refresh(){
    setErr("");
    try{
      const st = await getBotStatus();
      setStatus(st);
      const br = await getBotBearer();
      setBearer(br);

      if (st?.running){
        const cks = await getBotCookies().catch(()=>({cookies:[]}));
        const lsv = await getBotLocalStorage().catch(()=>({items:[]}));
        setCookies(cks?.cookies || cks?.data?.cookies || []);
        setLs(lsv?.items || lsv?.data?.items || []);
      } else {
        setCookies([]); setLs([]);
      }
    }catch(e){
      setErr(e?.message || "Ошибка");
    }
  }

  async function start(){ setBusy(true); setErr(""); try{ await botStart(); }catch(e){ setErr(e.message);} finally{ setBusy(false); await refresh(); } }
  async function stop(){ setBusy(true); setErr(""); try{ await botStop();  }catch(e){ setErr(e.message);} finally{ setBusy(false); await refresh(); } }
  async function go(){ setBusy(true); setErr(""); try{ await botGoto(url); }catch(e){ setErr(e.message);} finally{ setBusy(false); await refresh(); } }
  async function clearCookies(){ setBusy(true); setErr(""); try{ await botClearCookies(); }catch(e){ setErr(e.message);} finally{ setBusy(false); await refresh(); } }

  async function saveConfig(){
    setBusy(true); setErr("");
    try{
      // Отправляем только то, что реально редактируем.
      const payload = {
        access_token_key: form.access_token_key || "",
        id_token_key: form.id_token_key || "",
        // поля с токенами: если строка пустая — считаем очисткой; если undefined — «не менять».
        access_token_json: form.access_token_json, // "" → очистить, текст → записать
        id_token_json: form.id_token_json,
        sso_token: form.sso_token,
        apply_now: !!form.apply_now,
        reload_after: !!form.reload_after,
      };
      const res = await setBotConfig(payload);
      // обновим локальный снимок состояния
      await loadConfig();
      await refresh();
      // очистим секреты в форме, чтобы не торчали в UI
      setForm(f => ({ ...f, access_token_json: "", id_token_json: "", sso_token: "" }));
    }catch(e){
      setErr(`Ошибка сохранения конфига: ${e?.message || e}`);
    }finally{ setBusy(false); }
  }

  useEffect(()=>{ refresh(); loadConfig(); }, []);

  const bearerMasked = bearer?.bearer_masked || (bearer?.masked) || "";
  const bearerExp = bearer?.exp || status?.bearer_exp; // если сервер это отдаёт
  const bearerTs = status?.bearer_updated_ts ? new Date(status.bearer_updated_ts*1000 || status.bearer_updated_ts).toLocaleString() : "";

  return (
    <section className="space-y-4">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2">{err}</div>}

      <div className="rounded-xl border border-slate-200 p-3">
        <h2 className="text-lg font-medium mb-2">Админка бота</h2>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <button onClick={start} disabled={busy} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Старт</button>
          <button onClick={stop}  disabled={busy} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Стоп</button>
          <button onClick={refresh} disabled={busy} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Обновить статус</button>

          <input
            className="px-3 py-2 border border-slate-200 rounded-lg min-w-[360px] flex-1"
            value={url}
            onChange={e=>setUrl(e.target.value)}
            placeholder="URL для перехода"
          />
          <button onClick={go} disabled={busy} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Перейти</button>
        </div>

        <div className="text-sm text-slate-600 mb-2">
          Статус: {status ? (status.running ? "запущен" : "остановлен") : "…"} ·
          <span className="ml-1">bearer: {bearer?.have ? (bearerMasked || "есть") : "нет"}</span>
          {status?.bearer_exp && (
            <span className="ml-1">· exp: {new Date(status.bearer_exp*1000).toLocaleString()}</span>
          )}
          {bearerTs && <span className="ml-1">· обновлён: {bearerTs}</span>}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Cookies</h3>
              <button className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50"
                      onClick={clearCookies} disabled={busy || !status?.running}>
                Очистить
              </button>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                {cookies.map((c, i)=>(
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1">{c.domain}</td>
                    <td className="px-2 py-1 max-w-[380px] break-all">{c.value || "…"}</td>
                  </tr>
                ))}
                {!cookies.length && (
                  <tr><td colSpan={3} className="px-2 py-6 text-center text-slate-500">— нет —</td></tr>
                )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="font-medium mb-2">localStorage</h3>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                {ls.map((x, i)=>(
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1 whitespace-nowrap">{x.key}</td>
                    <td className="px-2 py-1 max-w-[420px] break-all">{String(x.value)}</td>
                  </tr>
                ))}
                {!ls.length && (
                  <tr><td colSpan={2} className="px-2 py-6 text-center text-slate-500">— пусто —</td></tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {status?.current_url && (
          <div className="text-sm text-slate-500 mt-2">Текущий URL: {status.current_url}</div>
        )}
      </div>

      {/* ===== Новая карточка: настройки токенов и ключей ===== */}
      <div className="rounded-xl border border-slate-200 p-3">
        <h2 className="text-lg font-medium mb-3">Настройки токенов и ключей</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1 text-slate-600">ACCESS_TOKEN_KEY</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                value={form.access_token_key}
                onChange={e=>setForm({...form, access_token_key: e.target.value})}
                placeholder="@@idaasjs@@::<app>::access_token"
              />
              <div className="text-xs text-slate-500 mt-1">Текущий: <span className="font-mono">{cfg.access_token_key || "—"}</span></div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-slate-600">ID_TOKEN_KEY</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                value={form.id_token_key}
                onChange={e=>setForm({...form, id_token_key: e.target.value})}
                placeholder="@@idaasjs@@::default::id_token"
              />
              <div className="text-xs text-slate-500 mt-1">Текущий: <span className="font-mono">{cfg.id_token_key || "—"}</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1 text-slate-600">SSO_TOKEN</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                value={form.sso_token}
                onChange={e=>setForm({...form, sso_token: e.target.value})}
                placeholder="вставь значение cookie sso_token…"
              />
              <div className="text-xs text-slate-500 mt-1">
                Сейчас: {cfg.has_sso_token ? <span className="text-emerald-600">есть</span> : <span className="text-slate-500">нет</span>}
                {cfg.sso_token_masked && <span className="ml-2 text-slate-600">{cfg.sso_token_masked}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-sm mb-1 text-slate-600">ACCESS_TOKEN_JSON</label>
            <textarea
              rows={6}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              value={form.access_token_json}
              onChange={e=>setForm({...form, access_token_json: e.target.value})}
              placeholder='Вставь JSON (как хранится в localStorage)'
            />
            <div className="text-xs text-slate-500 mt-1">
              Сейчас: {cfg.has_access_token_json ? <span className="text-emerald-600">есть</span> : <span className="text-slate-500">нет</span>}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-600">ID_TOKEN_JSON</label>
            <textarea
              rows={6}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
              value={form.id_token_json}
              onChange={e=>setForm({...form, id_token_json: e.target.value})}
              placeholder='Опционально: JSON id_token'
            />
            <div className="text-xs text-slate-500 mt-1">
              Сейчас: {cfg.has_id_token_json ? <span className="text-emerald-600">есть</span> : <span className="text-slate-500">нет</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3">
          <label className="inline-flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={form.apply_now}
              onChange={e=>setForm({...form, apply_now: e.target.checked})}
            />
            <span className="text-sm">Применить сейчас (localStorage/cookies)</span>
          </label>

          <label className="inline-flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={form.reload_after}
              onChange={e=>setForm({...form, reload_after: e.target.checked})}
              disabled={!status?.running}
            />
            <span className="text-sm">Перезагрузить страницу бота</span>
          </label>

          <div className="flex-1" />

          <button
            onClick={saveConfig}
            disabled={busy}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Сохранить
          </button>
        </div>
      </div>
    </section>
  );
}
