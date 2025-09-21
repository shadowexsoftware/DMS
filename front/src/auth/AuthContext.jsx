// src/auth/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as AuthAPI from "../api/auth";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(AuthAPI.getSession());
  const [loading, setLoading] = useState(false);

  async function doLogin(login, password){
    setLoading(true);
    try{
      const s = await AuthAPI.login({ login, password });
      setSession(s);
      return { ok:true };
    }catch(e){
      return { ok:false, error: e?.message || "Не удалось войти" };
    }finally{ setLoading(false); }
  }

  async function doRegister({ username, email, password }){
    setLoading(true);
    try{
      const s = await AuthAPI.register({ username, email, password });
      setSession(s);
      return { ok:true };
    }catch(e){
      return { ok:false, error: e?.message || "Не удалось зарегистрироваться" };
    }finally{ setLoading(false); }
  }

  function logout(){
    AuthAPI.logout();
    setSession(null);
  }

  // ★ При маунте — мягко валидируем токен и ПИШЕМ user из /auth/me
  useEffect(() => {
    const curr = AuthAPI.getSession();
    if (!curr?.token) return;
    setLoading(true);
    AuthAPI.me()
      .then((resp) => {
        // ваш /auth/me возвращает { ok:true, user:{...} }
        const user = resp?.user ?? resp?.data ?? null;
        if (user) {
          setSession(prev => prev
            ? { ...prev, user }
            : { token: curr.token, user }
          );
        }
      })
      .catch(() => {
        AuthAPI.logout();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    loading,
    isAuthenticated: Boolean(session?.token && session?.user),
    isAdmin: Boolean(session?.user?.is_admin), // ★ тут читаем ваш флаг
    login: doLogin,
    register: doRegister,
    logout,
    refreshUser: async () => {
      if (!session?.token) return;
      try{
        const resp = await AuthAPI.me();
        const user = resp?.user ?? resp?.data ?? null;
        if (user) setSession(prev => prev ? ({ ...prev, user }) : ({ token: session.token, user }));
      }catch(_){}
    }
  }), [session, loading]);

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  );
}
