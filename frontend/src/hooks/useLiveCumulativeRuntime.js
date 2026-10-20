import { useEffect, useRef, useState } from 'react';

const floorSeconds = (value) => Math.max(0, Math.floor(Number(value) || 0));

const getLiveTotal = (state) => {
  if (!state.isRunning || state.runAnchorMs == null) {
    return state.baseSeconds;
  }
  return state.baseSeconds + Math.floor((Date.now() - state.runAnchorMs) / 1000);
};

/**
 * Thời gian chạy lũy kế: tự tăng mỗi giây khi máy đang chạy, dừng khi máy dừng.
 * Đồng bộ lại khi server trả totalTimeOnSeconds mới (polling).
 */
export default function useLiveCumulativeRuntime(serverSeconds, isRunning, machineId) {
  const [, setTick] = useState(0);
  const stateRef = useRef({
    baseSeconds: 0,
    runAnchorMs: null,
    isRunning: false,
    lastServerSeconds: 0,
  });

  useEffect(() => {
    const base = floorSeconds(serverSeconds);
    stateRef.current = {
      baseSeconds: base,
      runAnchorMs: isRunning ? Date.now() : null,
      isRunning: Boolean(isRunning),
      lastServerSeconds: base,
    };
    setTick((n) => n + 1);
  }, [machineId]);

  useEffect(() => {
    const state = stateRef.current;
    const srv = floorSeconds(serverSeconds);
    const running = Boolean(isRunning);

    if (srv !== state.lastServerSeconds) {
      state.lastServerSeconds = srv;
      if (running) {
        const local = getLiveTotal(state);
        state.baseSeconds = Math.max(srv, local);
        state.runAnchorMs = Date.now();
      } else {
        state.baseSeconds = srv;
        state.runAnchorMs = null;
      }
      state.isRunning = running;
      setTick((n) => n + 1);
      return;
    }

    if (running !== state.isRunning) {
      if (!running && state.isRunning && state.runAnchorMs != null) {
        state.baseSeconds = getLiveTotal(state);
        state.runAnchorMs = null;
      } else if (running && !state.isRunning) {
        state.runAnchorMs = Date.now();
      }
      state.isRunning = running;
      setTick((n) => n + 1);
    }
  }, [serverSeconds, isRunning]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  return getLiveTotal(stateRef.current);
}
