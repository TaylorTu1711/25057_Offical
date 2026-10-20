import { useEffect, useRef } from 'react';

/**
 * Gọi callback định kỳ. Dùng ref để luôn gọi phiên bản callback mới nhất.
 */
export default function usePolling(callback, intervalMs, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    const id = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
