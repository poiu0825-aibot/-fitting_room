import { useEffect } from 'react';
export function useAnimationFrame(callback: (time: number) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    const tick = (time: number) => {
      callback(time);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [callback, enabled]);
}
