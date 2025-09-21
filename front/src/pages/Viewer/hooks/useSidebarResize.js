//src/pages/Viewer/hooks/useSidebarResize.js

import { useEffect, useRef, useState } from "react";

export default function useSidebarResize({ initial = 340, min = 240, max = 560 } = {}) {
  const mainRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(initial);
  const [isResizing, setIsResizing] = useState(false);

  function onResizeStart(e) {
    e.preventDefault();
    setIsResizing(true);
    window.addEventListener("mousemove", onResizing);
    window.addEventListener("mouseup", onResizeEnd);
  }
  function onResizing(e) {
    const left = mainRef.current?.getBoundingClientRect()?.left ?? 0;
    let w = e.clientX - left;
    if (w < min) w = min;
    if (w > max) w = max;
    setSidebarWidth(w);
  }
  function onResizeEnd() {
    setIsResizing(false);
    window.removeEventListener("mousemove", onResizing);
    window.removeEventListener("mouseup", onResizeEnd);
  }
  function onResizeReset() { setSidebarWidth(initial); }

  useEffect(() => () => {
    window.removeEventListener("mousemove", onResizing);
    window.removeEventListener("mouseup", onResizeEnd);
  }, []);

  return { mainRef, sidebarWidth, isResizing, onResizeStart, onResizeReset };
}
