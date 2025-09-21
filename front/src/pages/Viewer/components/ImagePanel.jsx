//src/pages/Viewer/components/ImagePanel.jsx

import React, { useEffect, useRef, useState } from "react";

export default function Lightbox({ open, src, alt = "", onClose }) {
  const wrapRef = useRef(null);
  const [state, setState] = useState({ scale: 1, x: 0, y: 0, dragging: false, dx: 0, dy: 0 });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "0") setState({ scale: 1, x: 0, y: 0, dragging: false, dx: 0, dy: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      setState((s) => {
        const scale = Math.min(8, Math.max(1, +(s.scale + delta).toFixed(2)));
        return { ...s, scale };
      });
    };
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => el?.removeEventListener("wheel", onWheel);
  }, [open]);

  const onMouseDown = (e) => {
    e.preventDefault();
    setState((s) => ({ ...s, dragging: true, dx: e.clientX - s.x, dy: e.clientY - s.y }));
  };
  const onMouseMove = (e) => {
    if (!state.dragging) return;
    e.preventDefault();
    setState((s) => ({ ...s, x: e.clientX - s.dx, y: e.clientY - s.dy }));
  };
  const stopDrag = () => setState((s) => ({ ...s, dragging: false }));

  const touchRef = useRef({ lastDist: 0, lastX: 0, lastY: 0, panning: false });
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchRef.current.panning = true;
      touchRef.current.lastX = e.touches[0].clientX - state.x;
      touchRef.current.lastY = e.touches[0].clientY - state.y;
    } else if (e.touches.length === 2) {
      touchRef.current.panning = false;
      const [a, b] = e.touches;
      touchRef.current.lastDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 1 && touchRef.current.panning) {
      const t = e.touches[0];
      setState((s) => ({ ...s, x: t.clientX - touchRef.current.lastX, y: t.clientY - touchRef.current.lastY }));
    } else if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const delta = dist - touchRef.current.lastDist;
      touchRef.current.lastDist = dist;
      setState((s) => {
        const scale = Math.min(8, Math.max(1, +(s.scale + delta / 300).toFixed(2)));
        return { ...s, scale };
      });
    }
  };
  const onTouchEnd = () => { touchRef.current.panning = false; };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={wrapRef}
        className="max-w-[96vw] max-h-[92vh] bg-white rounded-xl shadow-2xl p-2 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="absolute top-2 left-2 flex gap-2">
          <button
            className="rounded-md bg-white/95 border border-slate-300 px-2 py-1 text-sm shadow"
            onClick={() => setState({ scale: 1, x: 0, y: 0, dragging: false, dx: 0, dy: 0 })}
            title="Сброс (клавиша 0)"
          >
            Сброс
          </button>
        </div>
        <button
          className="absolute top-2 right-2 rounded-md bg-white/95 border border-slate-300 px-2 py-1 text-sm shadow"
          onClick={onClose}
          title="Закрыть (Esc)"
        >
          ✕
        </button>

        <div
          className="w-[80vw] max-w-[1600px] h-[80vh] max-h-[86vh] bg-white cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onMouseDown}
        >
          <img
            alt={alt}
            src={src}
            draggable={false}
            className="max-w-none"
            style={{
              transform: `translate(${state.x}px, ${state.y}px) scale(${state.scale})`,
              transformOrigin: "center center",
              background: "#fff",
            }}
          />
        </div>
      </div>
    </div>
  );
}
