import { useEffect, useRef, useState } from 'react';
import { POLL_INTERVALS } from '../config/polling';

/**
 * Giữ trạng thái boolean ổn định — tránh UI giật khi poll PLC (~3s) làm giá trị nhấp nháy.
 * Bật ngay khi true; tắt sau offGraceMs khi false (mặc định = chu kỳ poll status).
 */
export default function useStableMachineRunning(
  value,
  offGraceMs = POLL_INTERVALS.status,
) {
  const [stable, setStable] = useState(Boolean(value));
  const timerRef = useRef(null);

  useEffect(() => {
    if (value) {
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
    }, offGraceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, offGraceMs]);

  return stable;
}
