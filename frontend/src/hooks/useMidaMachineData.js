import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '../config/config';
import { authHeaders } from '../utils/auth';
import { POLL_INTERVALS } from '../config/polling';
import usePolling from './usePolling';
import { buildErrorStats } from '../utils/errorStats';
import { calcUsagePerformancePct } from '../utils/machinePerformance';

const normalizeDate = (iso) => new Date(iso).toISOString().split('T')[0];

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

const buildPerformance = (dailyData, rawData) => {
  const totalTimeOnSeconds = dailyData.reduce(
    (sum, item) => sum + (Number(item.time_on) || 0),
    0,
  );
  const totalTimeRunningSeconds = dailyData.reduce(
    (sum, item) => sum + (Number(item.time_running) || 0),
    0,
  );

  // Ưu tiên giá trị lũy kế mới nhất từ telemetry CNC
  const latestRaw = [...rawData].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  )[0];
  const latestTimeOn = Number(latestRaw?.time_on) || totalTimeOnSeconds;
  const latestTimeRunning = Number(latestRaw?.time_running) || totalTimeRunningSeconds;

  const totalTimeOn = (latestTimeOn / 3600).toFixed(1);

  // Hiệu suất vận hành = thời gian chạy / thời gian bật máy × 100
  const utilizationMachine = latestTimeOn > 0
    ? clampPct((latestTimeRunning / latestTimeOn) * 100)
    : 0;

  // Hiệu suất khai thác = thời gian bật máy / (số ngày lịch × 24h) × 100
  const performanceMachine = calcUsagePerformancePct(
    latestTimeOn || totalTimeOnSeconds,
    rawData,
    dailyData,
  );

  // Lũy kế kWh = ∫ power · d(time_running); fallback 1 mẫu: power × time_running
  let cumulativeEnergyKwh = energyKwhFromPowerAndTimeRun(rawData);
  if (cumulativeEnergyKwh <= 0) {
    const fromDaily = dailyData.reduce(
      (sum, item) => sum + (Number(item.power_consumption) || 0),
      0,
    );
    if (fromDaily > 0) {
      cumulativeEnergyKwh = fromDaily;
    } else {
      const latestPowerFallback = Number(latestRaw?.power) || 0;
      cumulativeEnergyKwh = latestPowerFallback * (latestTimeRunning / 3600);
    }
  }

  const latestPower = Number(latestRaw?.power ?? 0);
  const latestVoltage = Number(latestRaw?.avg_v ?? 0);
  const latestCurrent = Number(latestRaw?.avg_a ?? 0);
  const latestFrequency = Number(latestRaw?.frequency ?? latestRaw?.freq ?? 0);

  return {
    totalTimeOn,
    totalTimeOnSeconds: latestTimeOn || totalTimeOnSeconds,
    totalTimeRunningSeconds: latestTimeRunning || totalTimeRunningSeconds,
    shootMachine: Number(cumulativeEnergyKwh.toFixed(3)),
    powerKw: latestPower,
    voltageAvg: latestVoltage,
    currentAvg: latestCurrent,
    frequencyHz: latestFrequency,
    performanceMachine,
    utilizationMachine,
    latestDate: normalizeDate(
      rawData[rawData.length - 1]?.timestamp || new Date().toISOString(),
    ),
  };
};

const portalHeaders = () => authHeaders();

export default function useMidaMachineData(machineId) {
  const [machineInfo, setMachineInfo] = useState(null);
  const [statusMachine, setStatusMachine] = useState(null);
  const [errorsMachine, setErrorsMachine] = useState([]);
  const [allErrorsMachine, setAllErrorsMachine] = useState([]);
  const [rawMachineData, setRawMachineData] = useState([]);
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
  const hasChartDataRef = useRef(false);

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
    setStatusMachine(null);
    setMachineInfo(null);
    setLabelsChartErr([]);
    setTooltipLabelsChartErr([]);
    setDataValuesChartErr([]);
    setAllErrorsMachine([]);
    hasChartDataRef.current = false;
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

  const applyMachineParams = useCallback((data) => {
    if (!Array.isArray(data)) return;
    if (data.length === 0 && hasChartDataRef.current) return;

    hasChartDataRef.current = data.length > 0;
    setRawMachineData(data);
    const dailyData = buildDailyData(data);
    setRawData(dailyData);

    const perf = buildPerformance(dailyData, data);
    setTotalTimeOn(perf.totalTimeOn);
    setTotalTimeOnSeconds(perf.totalTimeOnSeconds);
    setTotalTimeRunningSeconds(perf.totalTimeRunningSeconds);
    setShootMachine(perf.shootMachine);
    setPowerKw(perf.powerKw);
    setVoltageAvg(perf.voltageAvg);
    setCurrentAvg(perf.currentAvg);
    setFrequencyHz(perf.frequencyHz);
    setPerformanceMachine(perf.performanceMachine);
    setUtilizationMachine(perf.utilizationMachine);
  }, []);

  const fetchMachineParams = useCallback(
    async ({ silent = false } = {}) => {
      if (!machineId) return;
      if (!silent) setIsLoading(true);
      try {
        const res = await axios.get(
          `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/telemetry`,
          { headers: portalHeaders() },
        );
        applyMachineParams(res.data);
      } catch (err) {
        console.error(err.message);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [machineId, applyMachineParams],
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
      await Promise.all([fetchErrors(), fetchMachineParams({ silent: true })]);
    } catch (err) {
      console.error(err.message);
    }
  }, [fetchErrors, fetchMachineParams]);

  const handleBootData = useCallback(async () => {
    if (!window.confirm('Bạn có chắc muốn dọn dữ liệu cũ?')) return;
    const res = await axios.delete(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/boot`,
      { headers: portalHeaders(), responseType: 'text' },
    );
    alert(res.data);
    await fetchMachineParams();
  }, [machineId, fetchMachineParams]);

  const fetchAllMachineData = useCallback(async () => {
    if (!machineId) return;
    try {
      setIsLoading(true);
      await Promise.all([
        fetchMachineInfo(),
        fetchErrors(),
        fetchMachineParams({ silent: true }),
        fetchMachines(),
      ]);
    } catch (err) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [machineId, fetchMachineInfo, fetchErrors, fetchMachineParams, fetchMachines]);

  useEffect(() => {
    fetchAllMachineData();
  }, [fetchAllMachineData]);

  usePolling(fetchStatusLive, POLL_INTERVALS.status, Boolean(machineId));
  usePolling(fetchLiveData, POLL_INTERVALS.live, Boolean(machineId));
  usePolling(fetchMachines, POLL_INTERVALS.locations, Boolean(machineId));

  return {
    machineInfo,
    statusMachine,
    errorsMachine,
    allErrorsMachine,
    rawMachineData,
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
    fetchAllMachineData,
    handleBootData,
  };
}
