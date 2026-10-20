import { useEffect, useState } from 'react';
import { POLL_INTERVALS } from '../config/polling';

/** Trả về timestamp hiện tại, cập nhật định kỳ để UI (vd. isConnected) re-render. */
export default function useNow(intervalMs = POLL_INTERVALS.connectionTick) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
