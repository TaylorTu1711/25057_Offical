import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '../config/config';
import { authHeaders } from '../utils/auth';
import { buildLast24hStatusGanttSegments } from '../utils/machineStatusTimeline';
import usePolling from './usePolling';

/** Poll Gantt chậm hơn trạng thái live để tránh N request nặng. */
const GANTT_POLL_MS = 30_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

function machineIdsKey(machines) {
  return (Array.isArray(machines) ? machines : [])
    .map((m) => m.machine_id)
    .filter(Boolean)
    .sort()
    .join('|');
}

/**
 * Tải telemetry 24h gần nhất cho từng máy trên layout → segments Gantt.
 * @returns {Record<string, { status: 0|1|2, pct: number }[]>}
 */
export default function useMidaFactoryStatusGantts(machines = [], enabled = true) {
  const [ganttById, setGanttById] = useState({});
  const machinesRef = useRef(machines);
  machinesRef.current = machines;
  const abortRef = useRef(null);
  const idsKey = machineIdsKey(machines);

  const fetchGantts = useCallback(async () => {
    const list = Array.isArray(machinesRef.current) ? machinesRef.current : [];
    if (!enabled || list.length === 0) {
      setGanttById({});
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const nowMs = Date.now();
    const from = new Date(nowMs - WINDOW_MS).toISOString();
    const to = new Date(nowMs).toISOString();

    const results = await Promise.allSettled(
      list.map(async (machine) => {
        const id = machine.machine_id;
        const res = await axios.get(
          `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(id)}/telemetry`,
          {
            headers: authHeaders(),
            params: { from, to },
            signal: controller.signal,
          },
        );
        const rows = Array.isArray(res.data) ? res.data : [];
        const segments = buildLast24hStatusGanttSegments(rows, nowMs, {
          currentStatus: machine.status,
          lastUpdated: machine.last_updated,
          intervalMinutes: 1,
          offlineThresholdMinutes: 2,
        });
        return { id, segments };
      }),
    );

    if (controller.signal.aborted) return;

    const next = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value?.id) {
        next[r.value.id] = r.value.segments;
      }
    });
    setGanttById((prev) => ({ ...prev, ...next }));
  }, [enabled]);

  useEffect(() => {
    fetchGantts();
    return () => abortRef.current?.abort();
  }, [fetchGantts, idsKey]);

  usePolling(fetchGantts, GANTT_POLL_MS, enabled && Boolean(idsKey));

  return ganttById;
}
