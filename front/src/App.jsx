// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import AdminRoute from "./auth/AdminRoute.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Viewer from "./pages/Viewer/Viewer.jsx";              // «Запрос на ТО»
import Admin from "./pages/admin/Admin.jsx";
import BusinessHome from "./pages/BusinessHome.jsx";  // ★ новая страница
import PagesLayout from "./layouts/PagesLayout.jsx";  // ★ общий лэйаут с левым меню

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-[100vh] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        <BrowserRouter>
          <Routes>
            {/* публичные */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* защищённые с общим левым меню страниц */}
            <Route
              element={
                <ProtectedRoute>
                  <PagesLayout />
                </ProtectedRoute>
              }
            >
              {/* редирект с корня на «Главную страницу бизнеса» */}
              <Route index element={<Navigate to="/business" replace />} />

              {/* страницы в левом меню */}
              <Route path="/business" element={<BusinessHome />} />
              <Route path="/service" element={<Viewer />} />
            </Route>

            {/* только для админов (вне общего лэйаута) */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />

            {/* всё прочее -> на /business */}
            <Route path="*" element={<Navigate to="/business" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}
