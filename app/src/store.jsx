import { createContext, useContext, useEffect, useRef, useState } from 'react';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/* State that survives a reload in this browser. Storage can be missing or throw, so every access is guarded. */
export function useLocal(key, initial, valid) {
  const [value, setValue] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      if (v !== null && (!valid || valid(v))) return typeof initial === 'object' && !Array.isArray(initial) ? { ...initial, ...v } : v;
    } catch (e) {}
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }, [key, value]);
  return [value, setValue];
}

/* A Claude runtime capability ("sample" to ask Claude, "mcp" for connectors). Null outside Claude or until granted. */
export function useCapability(name) {
  const [cap, setCap] = useState(null);
  const got = useRef(false);
  useEffect(() => {
    const attempt = () => {
      try {
        if (got.current || !(window.claude && window.claude.use)) return;
        window.claude.use(name).then((c) => { if (c && !got.current) { got.current = true; setCap(() => c); } }).catch(() => {});
      } catch (e) {}
    };
    attempt();
    const t = setTimeout(attempt, 1500);
    return () => clearTimeout(t);
  }, [name]);
  return cap;
}
