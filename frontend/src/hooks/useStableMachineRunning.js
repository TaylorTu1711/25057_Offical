import { useEffect, useRef, useState } from 'react';

/**
 * Giữ trạng thái "đang chạy" ổn định — tránh icon bánh răng giật khi poll PLC
 * làm status nhấp nháy ngắn. Chuyển sang STOP có trễ; chuyển sang RUN ngay lập tức.
 */
export default function useStableMachineRunning(isRunning, graceMs = 1200) {
  const [stable, setStable] = useState(Boolean(isRunning));
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setStable(true);
      return undefined;
    }

    timerRef.current = setTimeout(() => {
      setStable(false);
      timerRef.current = null;
    }, graceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, graceMs]);

  return stable;
}
