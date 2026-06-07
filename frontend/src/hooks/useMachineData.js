import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '../config/config';
import { POLL_INTERVALS } from '../config/polling';
import usePolling from './usePolling';
import { buildErrorStats } from '../utils/errorStats';
import { calcUsagePerformancePct } from '../utils/machinePerformance';

const normalizeDate = (iso) => new Date(iso).toISOString().split('T')[0];

const buildDailyData = (data) =>
  Object.values(
    data.reduce((acc, item) => {
      if (!item.timestamp) return acc;
      const date = item.timestamp.slice(0, 10);

      if (!acc[date]) {
        acc[date] = { min: item, max: item };
        return acc;
      }

      const currentTime = new Date(item.timestamp).getTime();
      const minTime = new Date(acc[date].min.timestamp).getTime();
      const maxTime = new Date(acc[date].max.timestamp).getTime();

      if (currentTime < minTime) acc[date].min = item;
      if (currentTime > maxTime) acc[date].max = item;
      return acc;
    }, {})
  ).map(({ min, max }) => {
    const outputDiff = (Number(max.product) || 0) - (Number(min.product) || 0);
    const timeOnDiff = (Number(max.time_on) || 0) - (Number(min.time_on) || 0);
    const inputDiff = (Number(max.input_material) || 0) - (Number(min.input_material) || 0);
    const isSingleReading = min.timestamp === max.timestamp;

    return {
      ...max,
      product: isSingleReading ? Number(max.product) || 0 : outputDiff < 0 ? Number(max.product) : outputDiff,
      time_on: isSingleReading ? Number(max.time_on) || 0 : timeOnDiff < 0 ? Number(max.time_on) : timeOnDiff,
      input_material: isSingleReading ? Number(max.input_material) || 0 : inputDiff < 0 ? Number(max.input_material) : inputDiff,
      min_timestamp: min.timestamp,
      max_timestamp: max.timestamp,
    };
  });

const buildPerformance = (dailyData, rawData) => {
  const totalTimeOnSeconds = dailyData.reduce(
    (sum, item) => sum + (Number(item.time_on) || 0),
    0,
  );
  const totalTimeOn = (totalTimeOnSeconds / 3600).toFixed(1);

  const sortedData = [...dailyData].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  );
  const groupedByDate = {};
  sortedData.forEach((item) => {
    const date = normalizeDate(item.timestamp);
    if (!groupedByDate[date]) groupedByDate[date] = item;
  });

  const nearestDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b) - new Date(a),
  );
  const latestShoot = nearestDates.length
    ? groupedByDate[nearestDates[0]]?.shoot || 0
    : 0;

  const performanceMachine = calcUsagePerformancePct(
    totalTimeOnSeconds,
    rawData,
    dailyData,
  );

  return {
    totalTimeOn,
    totalTimeOnSeconds,
    shootMachine: latestShoot,
    performanceMachine,
    latestDate: normalizeDate(
      rawData[rawData.length - 1]?.timestamp || new Date().toISOString(),
    ),
  };
};

export default function useMachineData(machineId) {
  const [machineInfo, setMachineInfo] = useState([]);
  const [statusMachine, setStatusMachine] = useState(null);
  const [errorsMachine, setErrorsMachine] = useState([]);
  const [allErrorsMachine, setAllErrorsMachine] = useState([]);
  const [rawMachineData, setRawMachineData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [machines, setMachines] = useState([]);
  const [duyTanLocations, setDuyTanLocations] = useState([]);
  const [otherLocations, setOtherLocations] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [labelsChartErr, setLabelsChartErr] = useState([]);
  const [tooltipLabelsChartErr, setTooltipLabelsChartErr] = useState([]);
  const [dataValuesChartErr, setDataValuesChartErr] = useState([]);
  const [totalTimeOn, setTotalTimeOn] = useState(0);
  const [totalTimeOnSeconds, setTotalTimeOnSeconds] = useState(0);
  const [performanceMachine, setPerformanceMachine] = useState(0);
  const [shootMachine, setShootMachine] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const hasChartDataRef = useRef(false);

  useEffect(() => {
    setTotalTimeOn(0);
    setTotalTimeOnSeconds(0);
    setPerformanceMachine(0);
    setShootMachine(0);
    setRawData([]);
    setRawMachineData([]);
    setStatusMachine(null);
    setMachineInfo([]);
    setLabelsChartErr([]);
    setTooltipLabelsChartErr([]);
    setDataValuesChartErr([]);
    setAllErrorsMachine([]);
    hasChartDataRef.current = false;
  }, [machineId]);

  const fetchMachinesByLocation = useCallback(async (location, isdtgroup) => {
    const response = await axios.get(
      `${BASE_URL}/api/machines?location=${encodeURIComponent(location)}&isdtgroup=${isdtgroup}`
    );
    setMachines(response.data);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!machineId) return;
    const res = await axios.get(`${BASE_URL}/api/status?machine_id=${machineId}`);
    const row = res.data?.[0];
    if (!row) return;
    setStatusMachine({
      ...row,
      status: row.status != null ? Number(row.status) : row.status,
    });
  }, [machineId]);

  const fetchMachineInfo = useCallback(async () => {
    if (!machineId) return;
    const res = await axios.get(`${BASE_URL}/api/machines/${machineId}`);
    const row = res.data?.[0];
    if (!row) return;
    setMachineInfo({
      ...row,
      status: row.status != null ? Number(row.status) : row.status,
    });
  }, [machineId]);

  const fetchLocations = useCallback(async () => {
    const response = await axios.get(`${BASE_URL}/api/locations/alllocations`);
    const jsonData = response.data;
    const all = jsonData.locations || [];
    setDuyTanLocations(all.filter((m) => m.isdtgroup === true));
    setOtherLocations(all.filter((m) => !m.isdtgroup));
    setAllLocations(all);
  }, []);

  const fetchErrors = useCallback(async () => {
    if (!machineId) return;
    const res = await axios.get(`${BASE_URL}/api/errorsmachine?machine_id=${machineId}`);
    const data = res.data;
    const sortedData = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const uniqueErrors = sortedData.filter(
      (error, index, self) => index === self.findIndex((e) => e.timestamp === error.timestamp)
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
    setShootMachine(perf.shootMachine);
    setPerformanceMachine(perf.performanceMachine);
  }, []);

  const fetchMachineParams = useCallback(
    async ({ silent = false } = {}) => {
      if (!machineId) return;
      if (!silent) setIsLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/detailMachine?machine_id=${machineId}`);
        applyMachineParams(res.data);
      } catch (err) {
        console.error(err.message);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [machineId, applyMachineParams]
  );

  const fetchStatusLive = useCallback(async () => {
    try {
      await Promise.all([fetchStatus(), fetchMachineInfo()]);
    } catch (err) {
      console.error(err.message);
    }
  }, [fetchStatus, fetchMachineInfo]);

  const fetchLiveData = useCallback(async () => {
    try {
      await Promise.all([fetchErrors(), fetchMachineParams({ silent: true })]);
    } catch (err) {
      console.error(err.message);
    }
  }, [fetchErrors, fetchMachineParams]);

  const handleBootData = useCallback(async () => {
    if (!window.confirm('Bạn có chắc muốn dọn dữ liệu cũ?')) return;
    const res = await axios.delete(`${BASE_URL}/api/boot/${machineId}`, {
      responseType: 'text',
    });
    const msg = res.data;
    alert(msg);
    await fetchMachineParams();
  }, [machineId, fetchMachineParams]);

  const fetchAllMachineData = useCallback(async () => {
    if (!machineId) return;
    try {
      setIsLoading(true);
      await Promise.all([
        fetchStatus(),
        fetchErrors(),
        fetchMachineParams({ silent: true }),
        fetchMachineInfo(),
        fetchLocations(),
      ]);
    } catch (err) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [machineId, fetchStatus, fetchErrors, fetchMachineParams, fetchMachineInfo, fetchLocations]);

  // Tải lần đầu khi vào trang / đổi máy
  useEffect(() => {
    fetchAllMachineData();
  }, [fetchAllMachineData]);

  // Làm mới realtime — không reload trang
  usePolling(fetchStatusLive, POLL_INTERVALS.status, Boolean(machineId));
  usePolling(fetchLiveData, POLL_INTERVALS.live, Boolean(machineId));
  usePolling(fetchLocations, POLL_INTERVALS.locations, Boolean(machineId));

  return {
    machineInfo,
    statusMachine,
    errorsMachine,
    allErrorsMachine,
    rawMachineData,
    rawData,
    machines,
    duyTanLocations,
    otherLocations,
    allLocations,
    labelsChartErr,
    tooltipLabelsChartErr,
    dataValuesChartErr,
    totalTimeOn,
    totalTimeOnSeconds,
    performanceMachine,
    shootMachine,
    isLoading,
    fetchAllMachineData,
    fetchMachinesByLocation,
    handleBootData,
  };
}
