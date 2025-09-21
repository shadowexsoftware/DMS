//src/pages/Viewer/components/Lightbox.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Лайтбокс с масштабом/панорамированием.
 * Esc — закрыть, +/− — зум, F — сбросить.
 */
export default function Lightbox({ open, src, alt = "", onClose }) {
  const imgRef = useRef(null);
  const outerRef = useRef(null);   // тёмная подложка
  const canvasRef = useRef(null);  // белый холст под картинкой

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drag, setDrag] = useState(null); // {x,y,tx0,ty0}

  // сброс при открытии/новом изображении
  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTx(0);
    setTy(0);
  }, [open, src]);

  // Esc, +/- , F
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(6, s * 1.2));
      if (e.key === "-" || e.key === "_") setScale((s) => Math.max(0.2, s / 1.2));
      if (e.key.toLowerCase() === "f") { setScale(1); setTx(0); setTy(0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // non-passive wheel на белом холсте
  useEffect(() => {
    if (!open) return;
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault(); // теперь можно — слушатель не пассивный
      const k = e.deltaY > 0 ? 1 / 1.15 : 1.15;
      setScale((prev) => {
        const next = Math.min(6, Math.max(0.2, prev * k));
        if (imgRef.current) {
          const rect = imgRef.current.getBoundingClientRect();
          const cx = e.clientX - (rect.left + rect.width / 2);
          const cy = e.clientY - (rect.top + rect.height / 2);
          const ratio = next / prev - 1;
          setTx((t) => t - cx * ratio);
          setTy((t) => t - cy * ratio);
        }
        return next;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  const onDoubleClick = (e) => {
    e.preventDefault();
    setScale((s) => (s < 1.8 ? 2 : 1));
    if (scale >= 1.8) { setTx(0); setTy(0); }
  };

  // drag/pan
  const startDrag = (x, y) => setDrag({ x, y, tx0: tx, ty0: ty });
  const moveDrag = (x, y) =>
    setDrag((d) => d ? (setTx(d.tx0 + (x - d.x)), setTy(d.ty0 + (y - d.y)), d) : d);
  const endDrag = () => setDrag(null);

  const onMouseDown = (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); };
  const onMouseMove = (e) => { if (drag) moveDrag(e.clientX, e.clientY); };
  const onMouseUp = endDrag;
  const onMouseLeave = endDrag;

  // touch + pinch
  const pinchRef = useRef(null);
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    } else if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchRef.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s0: scale };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 1 && drag) {
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    } else if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const k = dist / (pinchRef.current.dist || 1);
      setScale(() => Math.min(6, Math.max(0.2, pinchRef.current.s0 * k)));
    }
  };
  const onTouchEnd = () => { setDrag(null); pinchRef.current = null; };

  if (!open) return null;

  return (
    <div
      ref={outerRef}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === outerRef.current) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-w-[96vw] max-h-[92vh] w-[92vw] h-[88vh] bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
          <div className="inline-flex gap-2">
            <button
              className="px-2 py-1 rounded bg-white border border-slate-300 shadow-sm text-slate-700 hover:bg-slate-50"
              onClick={() => { setScale(1); setTx(0); setTy(0); }}
              title="По размеру (F)"
            >Fit</button>
            <button
              className="px-2 py-1 rounded bg-white border border-slate-300 shadow-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setScale((s) => Math.max(0.2, s/1.2))}
              title="Уменьшить (-)"
            >−</button>
            <button
              className="px-2 py-1 rounded bg-white border border-slate-300 shadow-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setScale((s) => Math.min(6, s*1.2))}
              title="Увеличить (+)"
            >+</button>
          </div>
          <button
            className="px-2 py-1 rounded bg-white border border-slate-300 shadow-sm text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            title="Закрыть (Esc)"
          >✕</button>
        </div>

        <div
          ref={canvasRef}
          className="w-full h-full bg-white cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            onDoubleClick={onDoubleClick}
            className="absolute top-1/2 left-1/2 max-w-none select-none"
            style={{
              transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
              transformOrigin: "center center",
              background: "#fff", 
            }}
          />
        </div>
      </div>
    </div>
  );
}
