import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '../config/config';
import { authHeaders } from '../utils/auth';
import { POLL_INTERVALS } from '../config/polling';
import usePolling from './usePolling';
import { buildErrorStats } from '../utils/errorStats';
import { calcUsagePerformancePctFromSpan } from '../utils/machinePerformance';

/**
 * Điện năng (kWh) = ∫ power(kW) · d(time_running giờ).
 * Dùng trung bình công suất giữa hai mẫu liên tiếp × Δtime_running.
 */
const energyKwhFromPowerAndTimeRun = (rows) => {
  if (!Array.isArray(rows) || rows.length < 2) return 0;

  const sorted = [...rows].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );

  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prevRun = Number(sorted[i - 1].time_running) || 0;
    const currRun = Number(sorted[i].time_running) || 0;
    const dtSec = currRun - prevRun;
    if (dtSec <= 0) continue;

    const p0 = Number(sorted[i - 1].power) || 0;
    const p1 = Number(sorted[i].power) || 0;
    total += ((p0 + p1) / 2) * (dtSec / 3600);
  }
  return total;
};

/** Fallback khi API /telemetry/daily chưa có — gom raw → daily phía client. */
const buildDailyData = (data) => {
  const buckets = data.reduce((acc, item) => {
    if (!item.timestamp) return acc;
    const date = String(item.timestamp).slice(0, 10);

    if (!acc[date]) {
      acc[date] = { min: item, max: item, samples: [item] };
      return acc;
    }

    const currentTime = new Date(item.timestamp).getTime();
    const minTime = new Date(acc[date].min.timestamp).getTime();
    const maxTime = new Date(acc[date].max.timestamp).getTime();

    if (currentTime < minTime) acc[date].min = item;
    if (currentTime > maxTime) acc[date].max = item;
    acc[date].samples.push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(buckets).sort();
  let prevClose = {
    product: 0,
    time_on: 0,
    time_running: 0,
    input_material: 0,
  };
  let prevDateKey = null;

  return sortedDates.map((date) => {
    const { min, max, samples } = buckets[date];
    const minProduct = Number(min.product) || 0;
    const maxProduct = Number(max.product) || 0;
    const minTimeOn = Number(min.time_on) || 0;
    const maxTimeOn = Number(max.time_on) || 0;
    const minTimeRunning = Number(min.time_running) || 0;
    const maxTimeRunning = Number(max.time_running) || 0;
    const minInput = Number(min.input_material) || 0;
    const maxInput = Number(max.input_material) || 0;

    const outputDiff = maxProduct - minProduct;
    const timeOnDiff = maxTimeOn - minTimeOn;
    const timeRunningDiff = maxTimeRunning - minTimeRunning;
    const inputDiff = maxInput - minInput;
    const isSingleReading =
      min.id != null && max.id != null
        ? min.id === max.id
        : min.timestamp === max.timestamp;

    const calendarSpanDays = prevDateKey
      ? Math.round(
          (new Date(`${date}T12:00:00`).getTime() - new Date(`${prevDateKey}T12:00:00`).getTime())
            / 86400000,
        )
      : 0;
    const hasMissingDaysBetween = calendarSpanDays > 1;

    const resolveDaily = (diff, minVal, maxVal, prevVal) => {
      if (diff < 0) return maxVal;
      if (!isSingleReading) {
        if (minVal + 1e-6 < prevVal) return Math.max(0, maxVal - prevVal);
        return diff;
      }
      if (!prevDateKey) return 0;
      if (hasMissingDaysBetween) return 0;
      return Math.max(0, maxVal - prevVal);
    };

    const product = resolveDaily(outputDiff, minProduct, maxProduct, prevClose.product);
    const time_on = resolveDaily(timeOnDiff, minTimeOn, maxTimeOn, prevClose.time_on);
    const time_running = resolveDaily(
      timeRunningDiff,
      minTimeRunning,
      maxTimeRunning,
      prevClose.time_running,
    );
    const input_material = resolveDaily(inputDiff, minInput, maxInput, prevClose.input_material);

    // Điện năng trong ngày: power × Δtime_running (không dùng cột power_consumption)
    let power_consumption = energyKwhFromPowerAndTimeRun(samples);
    if (power_consumption <= 0 && time_running > 0) {
      const avgPower = samples.length > 0
        ? samples.reduce((s, r) => s + (Number(r.power) || 0), 0) / samples.length
        : Number(max.power) || 0;
      power_consumption = avgPower * (time_running / 3600);
    }

    prevClose = {
      product: maxProduct,
      time_on: maxTimeOn,
      time_running: maxTimeRunning,
      input_material: maxInput,
    };
    prevDateKey = date;

    return {
      ...max,
      product,
      time_on,
      time_running,
      input_material,
      power_consumption,
      min_timestamp: min.timestamp,
      max_timestamp: max.timestamp,
    };
  });
};

const clampPct = (value) => Math.min(100, Math.max(0, Number(value.toFixed(1))));

/** Gauge hiệu suất — chỉ từ summary toàn lịch sử (không theo tháng/biểu đồ). */
const buildLifetimeGauges = (summary) => {
  const timeOn = Number(summary?.time_on) || 0;
  const timeRunning = Number(summary?.time_running) || 0;

  const utilizationMachine = timeOn > 0
    ? clampPct((timeRunning / timeOn) * 100)
    : 0;

  // Hiệu suất sử dụng = time_running / thời gian đưa máy vào hoạt động × 100
  const performanceMachine = calcUsagePerformancePctFromSpan(
    timeRunning,
    summary?.first_timestamp,
    summary?.last_timestamp,
  );

  return {
    totalTimeOn: (timeOn / 3600).toFixed(1),
    totalTimeOnSeconds: timeOn,
    totalTimeRunningSeconds: timeRunning,
    performanceMachine,
    utilizationMachine,
  };
};

const portalHeaders = () => authHeaders();

const fingerprintRows = (data) => {
  if (!Array.isArray(data) || data.length === 0) return '0';
  const first = data[0];
  const last = data[data.length - 1];
  return `${data.length}|${first?.timestamp ?? ''}|${last?.timestamp ?? ''}|${last?.time_running ?? ''}|${last?.time_on ?? ''}|${last?.power ?? ''}|${last?.power_consumption ?? ''}`;
};

/**
 * @param {object} options
 * @param {string|null} options.liveFrom — cửa sổ raw cho status/spindle
 * @param {string|null} options.liveTo
 * @param {string|null} options.dailyFrom — tổng hợp ngày cho biểu đồ ngày→năm
 * @param {string|null} options.dailyTo
 * @param {string|null} options.hourFrom — raw 1 ngày (mode giờ)
 * @param {string|null} options.hourTo
 */
export default function useMidaMachineData(machineId, {
  liveFrom = null,
  liveTo = null,
  dailyFrom = null,
  dailyTo = null,
  hourFrom = null,
  hourTo = null,
  /** @deprecated dùng liveFrom */
  telemetryFrom = null,
  telemetryTo = null,
} = {}) {
  const resolvedLiveFrom = liveFrom ?? telemetryFrom;
  const resolvedLiveTo = liveTo ?? telemetryTo;

  const [machineInfo, setMachineInfo] = useState(null);
  const [statusMachine, setStatusMachine] = useState(null);
  const [errorsMachine, setErrorsMachine] = useState([]);
  const [allErrorsMachine, setAllErrorsMachine] = useState([]);
  const [rawMachineData, setRawMachineData] = useState([]);
  const [hourTelemetryRows, setHourTelemetryRows] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [machines, setMachines] = useState([]);
  const [labelsChartErr, setLabelsChartErr] = useState([]);
  const [tooltipLabelsChartErr, setTooltipLabelsChartErr] = useState([]);
  const [dataValuesChartErr, setDataValuesChartErr] = useState([]);
  const [totalTimeOn, setTotalTimeOn] = useState(0);
  const [totalTimeOnSeconds, setTotalTimeOnSeconds] = useState(0);
  const [totalTimeRunningSeconds, setTotalTimeRunningSeconds] = useState(0);
  const [performanceMachine, setPerformanceMachine] = useState(0);
  const [utilizationMachine, setUtilizationMachine] = useState(0);
  const [shootMachine, setShootMachine] = useState(0);
  const [powerKw, setPowerKw] = useState(0);
  const [voltageAvg, setVoltageAvg] = useState(0);
  const [currentAvg, setCurrentAvg] = useState(0);
  const [frequencyHz, setFrequencyHz] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [chartRangeLoading, setChartRangeLoading] = useState(false);
  const rangeLoadingCountRef = useRef(0);
  const beginRangeLoading = useCallback(() => {
    rangeLoadingCountRef.current += 1;
    setChartRangeLoading(true);
  }, []);
  const endRangeLoading = useCallback(() => {
    rangeLoadingCountRef.current = Math.max(0, rangeLoadingCountRef.current - 1);
    if (rangeLoadingCountRef.current === 0) setChartRangeLoading(false);
  }, []);

  const hasLiveDataRef = useRef(false);
  const hasDailyDataRef = useRef(false);
  const lastLiveFingerprintRef = useRef('');
  const lastDailyFingerprintRef = useRef('');
  const lastHourFingerprintRef = useRef('');
  const dailyRowsRef = useRef([]);

  const liveFromRef = useRef(resolvedLiveFrom);
  const liveToRef = useRef(resolvedLiveTo);
  const dailyFromRef = useRef(dailyFrom);
  const dailyToRef = useRef(dailyTo);
  const hourFromRef = useRef(hourFrom);
  const hourToRef = useRef(hourTo);
  liveFromRef.current = resolvedLiveFrom;
  liveToRef.current = resolvedLiveTo;
  dailyFromRef.current = dailyFrom;
  dailyToRef.current = dailyTo;
  hourFromRef.current = hourFrom;
  hourToRef.current = hourTo;

  useEffect(() => {
    setTotalTimeOn(0);
    setTotalTimeOnSeconds(0);
    setTotalTimeRunningSeconds(0);
    setPerformanceMachine(0);
    setUtilizationMachine(0);
    setShootMachine(0);
    setPowerKw(0);
    setVoltageAvg(0);
    setCurrentAvg(0);
    setFrequencyHz(0);
    setRawData([]);
    setRawMachineData([]);
    setHourTelemetryRows([]);
    setStatusMachine(null);
    setMachineInfo(null);
    setLabelsChartErr([]);
    setTooltipLabelsChartErr([]);
    setDataValuesChartErr([]);
    setAllErrorsMachine([]);
    hasLiveDataRef.current = false;
    hasDailyDataRef.current = false;
    lastLiveFingerprintRef.current = '';
    lastDailyFingerprintRef.current = '';
    lastHourFingerprintRef.current = '';
    dailyRowsRef.current = [];
  }, [machineId]);

  const applyMachineInfo = useCallback((row) => {
    if (!row) return;
    const info = {
      ...row,
      status: row.status != null ? Number(row.status) : row.status,
    };
    setMachineInfo(info);
    setStatusMachine({
      machine_name: info.machine_name,
      status: info.status,
      last_updated: info.last_updated,
    });
  }, []);

  const updateElectricalFromLive = useCallback((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const latest = rows[rows.length - 1];
    setPowerKw(Number(latest?.power) || 0);
    setVoltageAvg(Number(latest?.avg_v) || 0);
    setCurrentAvg(Number(latest?.avg_a) || 0);
    setFrequencyHz(Number(latest?.frequency ?? latest?.freq) || 0);

    const latestKwh = Number(latest?.power_consumption) || 0;
    if (latestKwh > 0) {
      setShootMachine(Number(latestKwh.toFixed(3)));
      return;
    }
    const fromDaily = dailyRowsRef.current.reduce(
      (sum, item) => sum + (Number(item.power_consumption) || 0),
      0,
    );
    if (fromDaily > 0) setShootMachine(Number(fromDaily.toFixed(3)));
  }, []);

  const applyLiveTelemetry = useCallback((data) => {
    if (!Array.isArray(data)) return;
    if (data.length === 0 && hasLiveDataRef.current) return;

    const fingerprint = fingerprintRows(data);
    if (fingerprint === lastLiveFingerprintRef.current) return;
    lastLiveFingerprintRef.current = fingerprint;

    hasLiveDataRef.current = data.length > 0;
    setRawMachineData(data);
    updateElectricalFromLive(data);
  }, [updateElectricalFromLive]);

  const applyDailyTelemetry = useCallback((data) => {
    if (!Array.isArray(data)) return;
    if (data.length === 0 && hasDailyDataRef.current) return;

    const fingerprint = fingerprintRows(data);
    if (fingerprint === lastDailyFingerprintRef.current) return;
    lastDailyFingerprintRef.current = fingerprint;

    hasDailyDataRef.current = data.length > 0;
    dailyRowsRef.current = data;
    setRawData(data);

    // Nếu chưa có kWh lũy kế từ live, dùng tổng daily
    setShootMachine((prev) => {
      if (prev > 0) return prev;
      const sum = data.reduce((s, item) => s + (Number(item.power_consumption) || 0), 0);
      return Number(sum.toFixed(3));
    });
  }, []);

  const applyHourTelemetry = useCallback((data) => {
    if (!Array.isArray(data)) return;
    const fingerprint = fingerprintRows(data);
    if (fingerprint === lastHourFingerprintRef.current) return;
    lastHourFingerprintRef.current = fingerprint;
    setHourTelemetryRows(data);
  }, []);

  const fetchMachineInfo = useCallback(async () => {
    if (!machineId) return;
    const res = await axios.get(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}`,
      { headers: portalHeaders() },
    );
    applyMachineInfo(res.data);
  }, [machineId, applyMachineInfo]);

  const fetchMachines = useCallback(async () => {
    const res = await axios.get(`${BASE_URL}/api/portal/mida/cnc-machines?type=cnc`, {
      headers: portalHeaders(),
    });
    setMachines(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchErrors = useCallback(async () => {
    if (!machineId) return;
    const res = await axios.get(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/alarms`,
      { headers: portalHeaders() },
    );
    const data = Array.isArray(res.data) ? res.data : [];
    const sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const uniqueErrors = sortedData.filter(
      (error, index, self) => index === self.findIndex((e) => e.timestamp === error.timestamp),
    );
    setErrorsMachine(uniqueErrors);
    setAllErrorsMachine(data);

    const stats = buildErrorStats(data);
    setLabelsChartErr(stats.labels);
    setTooltipLabelsChartErr(stats.tooltipLabels);
    setDataValuesChartErr(stats.dataValues);
  }, [machineId]);

  const applyPerformanceSummary = useCallback((summary) => {
    const gauges = buildLifetimeGauges(summary);
    setTotalTimeOn(gauges.totalTimeOn);
    setTotalTimeOnSeconds(gauges.totalTimeOnSeconds);
    setTotalTimeRunningSeconds(gauges.totalTimeRunningSeconds);
    setPerformanceMachine(gauges.performanceMachine);
    setUtilizationMachine(gauges.utilizationMachine);
  }, []);

  const fetchPerformanceSummary = useCallback(async () => {
    if (!machineId) return;
    const res = await axios.get(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/performance`,
      { headers: portalHeaders() },
    );
    applyPerformanceSummary(res.data);
  }, [machineId, applyPerformanceSummary]);

  const fetchLiveTelemetry = useCallback(
    async ({ silent = true } = {}) => {
      if (!machineId) return;
      if (!silent) setIsLoading(true);
      try {
        const params = {};
        if (liveFromRef.current) params.from = liveFromRef.current;
        if (liveToRef.current) params.to = liveToRef.current;
        const res = await axios.get(
          `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/telemetry`,
          { headers: portalHeaders(), params },
        );
        applyLiveTelemetry(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err.message);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [machineId, applyLiveTelemetry],
  );

  const fetchDailyTelemetry = useCallback(
    async ({ silent = true } = {}) => {
      if (!machineId) return;
      try {
        const params = {};
        if (dailyFromRef.current) params.from = dailyFromRef.current;
        if (dailyToRef.current) params.to = dailyToRef.current;
        const res = await axios.get(
          `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/telemetry/daily`,
          { headers: portalHeaders(), params },
        );
        applyDailyTelemetry(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err.message);
        // Fallback: gom daily từ raw cửa sổ daily (tương thích backend cũ)
        try {
          const params = {};
          if (dailyFromRef.current) params.from = dailyFromRef.current;
          if (dailyToRef.current) params.to = dailyToRef.current;
          const res = await axios.get(
            `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/telemetry`,
            { headers: portalHeaders(), params },
          );
          applyDailyTelemetry(buildDailyData(Array.isArray(res.data) ? res.data : []));
        } catch (fallbackErr) {
          console.error(fallbackErr.message);
        }
      }
    },
    [machineId, applyDailyTelemetry],
  );

  const fetchHourTelemetry = useCallback(
    async () => {
      if (!machineId || !hourFromRef.current) {
        setHourTelemetryRows([]);
        lastHourFingerprintRef.current = '';
        return;
      }
      try {
        const params = { from: hourFromRef.current };
        if (hourToRef.current) params.to = hourToRef.current;
        const res = await axios.get(
          `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/telemetry`,
          { headers: portalHeaders(), params },
        );
        applyHourTelemetry(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err.message);
      }
    },
    [machineId, applyHourTelemetry],
  );

  const fetchStatusLive = useCallback(async () => {
    try {
      await fetchMachineInfo();
    } catch (err) {
      console.error(err.message);
    }
  }, [fetchMachineInfo]);

  const fetchLiveData = useCallback(async () => {
    try {
      await Promise.all([
        fetchErrors(),
        fetchPerformanceSummary(),
      ]);
    } catch (err) {
      console.error(err.message);
    }
  }, [fetchErrors, fetchPerformanceSummary]);

  const handleBootData = useCallback(async () => {
    if (!window.confirm(
      'Dọn dữ liệu: hôm nay giữ ~10 giây/mẫu; các ngày trước gộp 1 phút/mẫu (công suất & dòng = trung bình). Tiếp tục?',
    )) return;
    try {
      const res = await axios.delete(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/boot`,
        {
          headers: portalHeaders(),
          responseType: 'text',
          timeout: 300_000,
        },
      );
      const msg = typeof res.data === 'string' ? res.data : String(res.data ?? '');
      alert(msg || 'Boot xong.');
      await Promise.all([
        fetchLiveTelemetry({ silent: true }),
        fetchDailyTelemetry({ silent: true }),
        fetchHourTelemetry(),
        fetchPerformanceSummary(),
      ]);
    } catch (err) {
      const data = err.response?.data;
      const raw = typeof data === 'string' ? data : (data?.error || err.message || '');
      const is502 = err.response?.status === 502 || /502|Bad Gateway|<html/i.test(String(raw));
      alert(
        is502
          ? 'Boot thất bại: máy chủ timeout (502). Dữ liệu quá lớn hoặc proxy hết hạn — thử lại sau khi cập nhật backend.'
          : (raw && !/<html/i.test(String(raw)) ? raw : `Boot thất bại: ${err.message || 'lỗi mạng'}`),
      );
    }
  }, [
    machineId,
    fetchLiveTelemetry,
    fetchDailyTelemetry,
    fetchHourTelemetry,
    fetchPerformanceSummary,
  ]);

  const fetchAllMachineData = useCallback(async () => {
    if (!machineId) return;
    try {
      setIsLoading(true);
      await Promise.all([
        fetchMachineInfo(),
        fetchErrors(),
        fetchLiveTelemetry({ silent: true }),
        fetchDailyTelemetry({ silent: true }),
        fetchHourTelemetry(),
        fetchPerformanceSummary(),
        fetchMachines(),
      ]);
    } catch (err) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [
    machineId,
    fetchMachineInfo,
    fetchErrors,
    fetchLiveTelemetry,
    fetchDailyTelemetry,
    fetchHourTelemetry,
    fetchPerformanceSummary,
    fetchMachines,
  ]);

  const saveMachineInformation = useCallback(async (payload) => {
    if (!machineId) throw new Error('Thiếu mã máy');
    const body = typeof payload === 'string'
      ? { information: payload }
      : {
          information: payload?.information,
          machine_name: payload?.machine_name,
        };
    const res = await axios.patch(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/info`,
      body,
      { headers: portalHeaders() },
    );
    applyMachineInfo(res.data);
    setMachines((prev) =>
      Array.isArray(prev)
        ? prev.map((m) =>
          m.machine_id === machineId
            ? { ...m, machine_name: res.data.machine_name, information: res.data.information }
            : m,
        )
        : prev,
    );
    return res.data;
  }, [machineId, applyMachineInfo]);

  const refetchTelemetry = useCallback(async () => {
    await Promise.all([
      fetchLiveTelemetry({ silent: true }),
      fetchDailyTelemetry({ silent: true }),
      fetchHourTelemetry(),
    ]);
  }, [fetchLiveTelemetry, fetchDailyTelemetry, fetchHourTelemetry]);

  useEffect(() => {
    fetchAllMachineData();
  }, [fetchAllMachineData]);

  // Đổi cửa sổ live → refetch raw status/spindle
  const skipLiveRefetchRef = useRef(true);
  useEffect(() => {
    skipLiveRefetchRef.current = true;
  }, [machineId]);
  useEffect(() => {
    if (!machineId) return undefined;
    if (skipLiveRefetchRef.current) {
      skipLiveRefetchRef.current = false;
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      await fetchLiveTelemetry({ silent: true });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [machineId, resolvedLiveFrom, resolvedLiveTo, fetchLiveTelemetry]);

  // Đổi năm / cửa sổ daily → refetch tổng hợp ngày (có spinner)
  const skipDailyRefetchRef = useRef(true);
  const dailyCoveredRef = useRef('');
  useEffect(() => {
    skipDailyRefetchRef.current = true;
    dailyCoveredRef.current = '';
    rangeLoadingCountRef.current = 0;
    setChartRangeLoading(false);
  }, [machineId]);
  useEffect(() => {
    if (!machineId || !dailyFrom) return undefined;
    if (skipDailyRefetchRef.current) {
      skipDailyRefetchRef.current = false;
      dailyCoveredRef.current = `${dailyFrom}|${dailyTo || ''}`;
      return undefined;
    }
    const key = `${dailyFrom}|${dailyTo || ''}`;
    if (key === dailyCoveredRef.current && hasDailyDataRef.current) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      beginRangeLoading();
      try {
        await fetchDailyTelemetry({ silent: true });
        if (!cancelled) dailyCoveredRef.current = key;
      } finally {
        endRangeLoading();
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [machineId, dailyFrom, dailyTo, fetchDailyTelemetry, beginRangeLoading, endRangeLoading]);

  // Mode giờ: tải raw đúng 1 ngày
  const skipHourRefetchRef = useRef(true);
  useEffect(() => {
    skipHourRefetchRef.current = true;
  }, [machineId]);
  useEffect(() => {
    if (!machineId) return undefined;
    if (!hourFrom) {
      setHourTelemetryRows([]);
      lastHourFingerprintRef.current = '';
      return undefined;
    }
    if (skipHourRefetchRef.current) {
      skipHourRefetchRef.current = false;
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      beginRangeLoading();
      try {
        await fetchHourTelemetry();
      } finally {
        endRangeLoading();
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [machineId, hourFrom, hourTo, fetchHourTelemetry, beginRangeLoading, endRangeLoading]);

  usePolling(fetchStatusLive, POLL_INTERVALS.status, Boolean(machineId));
  usePolling(fetchLiveData, POLL_INTERVALS.live, Boolean(machineId));
  usePolling(
    () => fetchLiveTelemetry({ silent: true }),
    POLL_INTERVALS.telemetry,
    Boolean(machineId),
  );
  usePolling(
    () => fetchDailyTelemetry({ silent: true }),
    POLL_INTERVALS.telemetryDaily,
    Boolean(machineId && dailyFrom),
  );
  usePolling(fetchMachines, POLL_INTERVALS.locations, Boolean(machineId));
  usePolling(
    fetchHourTelemetry,
    POLL_INTERVALS.telemetry,
    Boolean(machineId && hourFrom),
  );

  return {
    machineInfo,
    statusMachine,
    errorsMachine,
    allErrorsMachine,
    rawMachineData,
    hourTelemetryRows,
    rawData,
    machines,
    labelsChartErr,
    tooltipLabelsChartErr,
    dataValuesChartErr,
    totalTimeOn,
    totalTimeOnSeconds,
    totalTimeRunningSeconds,
    performanceMachine,
    utilizationMachine,
    shootMachine,
    powerKw,
    voltageAvg,
    currentAvg,
    frequencyHz,
    isLoading,
    chartRangeLoading,
    fetchAllMachineData,
    handleBootData,
    saveMachineInformation,
    refetchTelemetry,
  };
}
