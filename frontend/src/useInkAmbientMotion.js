import { useEffect, useState } from "react";

export function useInkAmbientMotion(ref, enabled = true, settleMs = 8000) {
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) {
      setVisible(false);
      setSettled(true);
      return undefined;
    }
    let timer = null;
    let intersecting = false;
    let pageVisible = document.visibilityState === "visible";
    const sync = () => setVisible(enabled && intersecting && pageVisible && !settled);
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setVisible(false);
        setSettled(true);
      }, settleMs);
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = Boolean(entry?.isIntersecting);
      sync();
    }, { threshold: 0.05 });
    observer.observe(node);
    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      sync();
      if (pageVisible) settle();
    };
    const onActivity = () => {
      if (settled) setSettled(false);
      settle();
    };
    node.addEventListener("pointerdown", onActivity, { passive: true });
    node.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisibility);
    settle();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      node.removeEventListener("pointerdown", onActivity);
      node.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, ref, settleMs, settled]);
  return visible;
}
