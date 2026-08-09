import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';

import LineChart_TimeOn from '../../components/BarChart_Thoigian';
import CumulativeRuntimeDisplay from '../../components/machine/CumulativeRuntimeDisplay';
import MachineInfoModal from '../../components/machine/MachineInfoModal';
import MachineStatusIconPanel from '../../components/machine/MachineStatusIconPanel';
import MachineTimeRangePanel from '../../components/machine/MachineTimeRangePanel';
import TimeRangeModal from '../../components/machine/TimeRangeModal';
import AutoFitMachineName from '../../components/machine/AutoFitMachineName';

import MidaNavbar from '../../components/mida/MidaNavbar';
import MidaMachineSidebar from '../../components/mida/MidaMachineSidebar';
import MidaMachineSidebarMobile from '../../components/mida/MidaMachineSidebarMobile';
import MidaGaugeChart from '../../components/mida/MidaGaugeChart';
import MidaElectricalCards from '../../components/mida/MidaElectricalCards';
import MidaPowerCurrentChart from '../../components/mida/MidaPowerCurrentChart';
import MidaEfficiencyChart from '../../components/mida/MidaEfficiencyChart';
import MidaStatusChart from '../../components/mida/MidaStatusChart';

import useMidaMachineData from '../../hooks/useMidaMachineData';
import useNow from '../../hooks/useNow';
import useStableMachineRunning from '../../hooks/useStableMachineRunning';

import { BASE_URL } from '../../config/config';
import { authHeaders, getRole } from '../../utils/auth';
import { POLL_INTERVALS } from '../../config/polling';
import {
  getMachineStatusLabel,
  isMachineConnected,
  isMachineRunning,
} from '../../utils/machineStatus';
import {
  CHART_VIEW_MODES,
  RANGE_DISPLAY_MODES,
  getDefaultRangeDates,
  buildTimeSeries,
  buildEfficiencySeries,
  toErrorChartTickMode,
  getChartCategoryPrefix,
  getYearKeysFromData,
} from '../../utils/chartViewRange';
import { parseHandoverDate } from '../../utils/parseStandardProductivity';
import {
  buildStatusTimelineChartSeconds,
  buildPowerCurrentTimelineChart,
} from '../../utils/machineStatusTimeline';

import '../../css/Machine.css';
import '../../css/MidaCnc.css';

const getRollingFromDate = (minutesAgo, to = new Date()) => {
  const d = new Date(to);
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d;
};

const STATUS_RANGE_PRESETS = [
  { id: '1h', label: '1h', minutes: 60 },
  { id: '6h', label: '6h', minutes: 360 },
  { id: '12h', label: '12h', minutes: 720 },
  { id: '24h', label: '24h', minutes: 1440 },
  { id: 'today', label: 'Hôm nay' },
];

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

/** Resolve khoảng thời gian biểu đồ trạng thái theo preset / custom. */
function resolveStatusRange(mode, customFrom, customTo, nowMs) {
  const to = new Date(nowMs);
  if (mode === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom);
    let end = new Date(customTo);
    // Tuỳ chọn: chỉ hiển thị trong cùng một ngày lịch
    if (!isSameLocalDay(from, end)) {
      end = new Date(from);
      end.setHours(23, 59, 59, 999);
    }
    if (from.getTime() <= end.getTime()) {
      return { from, to: end, isLive: false };
    }
  }
  if (mode === 'today') {
    const from = new Date(to);
    from.setHours(0, 0, 0, 0);
    return { from, to, isLive: true };
  }
  const preset = STATUS_RANGE_PRESETS.find((p) => p.id === mode);
  const minutes = preset?.minutes ?? 1440;
  return { from: getRollingFromDate(minutes, to), to, isLive: true };
}

/** Độ phân giải bucket trạng thái cố định 10 giây (giống công suất). */
const STATUS_CHART_INTERVAL_SECONDS = 10;

/**
 * Cửa sổ tải telemetry tối thiểu để đủ cho status + điện + biểu đồ tháng.
 * Làm tròn theo phút để không refetch mỗi giây.
 */
function computeTelemetryFromIso({
  statusRangeMode,
  statusFrom,
  elecRangeMode,
  elecFrom,
  selectedYear,
  selectedMonth,
  chartViewMode,
  nowMinute,
}) {
  const nowMs = nowMinute * 60_000;
  let earliest = nowMs - 24 * 60 * 60 * 1000;

  const applyRange = (mode, customFrom) => {
    if (mode === 'custom' && customFrom) {
      earliest = Math.min(earliest, new Date(customFrom).getTime());
    } else if (mode === 'today') {
      const start = new Date(nowMs);
      start.setHours(0, 0, 0, 0);
      earliest = Math.min(earliest, start.getTime());
    } else {
      const preset = STATUS_RANGE_PRESETS.find((p) => p.id === mode);
      if (preset?.minutes) {
        earliest = Math.min(earliest, nowMs - preset.minutes * 60_000);
      }
    }
  };

  applyRange(statusRangeMode, statusFrom);
  applyRange(elecRangeMode, elecFrom);

  if (chartViewMode === CHART_VIEW_MODES.month) {
    earliest = Math.min(earliest, new Date(selectedYear, 0, 1).getTime());
  } else {
    earliest = Math.min(earliest, new Date(selectedYear, selectedMonth - 1, 1).getTime());
  }

  earliest -= 5 * 60_000;
  return new Date(earliest).toISOString();
}

const chartSeriesEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
};

export default function MidaCncMachineDetail() {
  const { machine_id } = useParams();
  const navigate = useNavigate();
  const now = useNow(POLL_INTERVALS.connectionTick);
  const isAdmin = getRole() === 'admin';

  const [chartViewMode, setChartViewMode] = useState(CHART_VIEW_MODES.day);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [rangeFrom, setRangeFrom] = useState(() => getDefaultRangeDates().from);
  const [rangeTo, setRangeTo] = useState(() => getDefaultRangeDates().to);
  const [rangeDisplay, setRangeDisplay] = useState(RANGE_DISPLAY_MODES.day);
  const [statusRangeMode, setStatusRangeMode] = useState('1h');
  const [statusFrom, setStatusFrom] = useState(null);
  const [statusTo, setStatusTo] = useState(null);
  const [elecRangeMode, setElecRangeMode] = useState('1h');
  const [elecFrom, setElecFrom] = useState(null);
  const [elecTo, setElecTo] = useState(null);

  const nowMinute = Math.floor(now / 60_000);
  const telemetryFrom = useMemo(
    () =>
      computeTelemetryFromIso({
        statusRangeMode,
        statusFrom,
        elecRangeMode,
        elecFrom,
        selectedYear,
        selectedMonth,
        chartViewMode,
        nowMinute,
      }),
    [
      statusRangeMode,
      statusFrom,
      elecRangeMode,
      elecFrom,
      selectedYear,
      selectedMonth,
      chartViewMode,
      nowMinute,
    ],
  );

  const machineData = useMidaMachineData(machine_id, { telemetryFrom });
  const {
    machineInfo,
    rawMachineData,
    rawData,
    statusMachine,
    allErrorsMachine,
    machines,
    totalTimeOnSeconds,
    totalTimeRunningSeconds,
    performanceMachine,
    utilizationMachine,
    shootMachine,
    powerKw,
    voltageAvg,
    currentAvg,
    isLoading,
    handleBootData,
    saveMachineInformation,
    refetchTelemetry,
  } = machineData;

  const [deleting, setDeleting] = useState(false);
  const [savingInformation, setSavingInformation] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const offcanvasRef = useRef(null);
  const [offcanvasInstance, setOffcanvasInstance] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!offcanvasRef.current) return;

      if (e.clientX < 10 && !isOpen) {
        const instance = Offcanvas.getOrCreateInstance(offcanvasRef.current);
        instance.show();
        setOffcanvasInstance(instance);
        setIsOpen(true);

        offcanvasRef.current.addEventListener(
          'hidden.bs.offcanvas',
          () => setIsOpen(false),
          { once: true },
        );
      }

      if (e.clientX > 400 && isOpen && offcanvasInstance) {
        offcanvasInstance.hide();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen, offcanvasInstance]);


  const [chartLabels, setChartLabels] = useState([]);
  const [timeRunValues, setTimeRunValues] = useState([]);
  const [energyKwhValues, setEnergyKwhValues] = useState([]);
  const [efficiencyLabels, setEfficiencyLabels] = useState([]);
  const [utilizationChartValues, setUtilizationChartValues] = useState([]);
  const [usageChartValues, setUsageChartValues] = useState([]);
  const [powerChartValues, setPowerChartValues] = useState([]);
  const [elecChartTimestamps, setElecChartTimestamps] = useState([]);
  const [statusChartTimestamps, setStatusChartTimestamps] = useState([]);
  const [statusDataValuesChart3, setStatusDataValuesChart3] = useState([]);
  const [showStatusRangeModal, setShowStatusRangeModal] = useState(false);
  const [tempStatusFrom, setTempStatusFrom] = useState(null);
  const [tempStatusTo, setTempStatusTo] = useState(null);
  const [showElecRangeModal, setShowElecRangeModal] = useState(false);
  const [tempElecFrom, setTempElecFrom] = useState(null);
  const [tempElecTo, setTempElecTo] = useState(null);
  const [modals, setModals] = useState({
    machineInfo: false,
  });

  // Bỏ qua lần mount (fetchAll đã tải); chỉ refetch khi cửa sổ from đổi
  const skipTelemetryRefetchRef = useRef(true);
  useEffect(() => {
    skipTelemetryRefetchRef.current = true;
  }, [machine_id]);
  useEffect(() => {
    if (!refetchTelemetry) return;
    if (skipTelemetryRefetchRef.current) {
      skipTelemetryRefetchRef.current = false;
      return;
    }
    refetchTelemetry();
  }, [telemetryFrom, refetchTelemetry]);

  const currentMachineStatus =
    statusMachine?.status ?? machineInfo?.status ?? null;
  const machineIsConnected = isMachineConnected(
    machineInfo?.last_updated ?? statusMachine?.last_updated,
    now,
  );
  const machineIsConnectedForIcon = useStableMachineRunning(machineIsConnected);
  const statusRunningStable = useStableMachineRunning(isMachineRunning(currentMachineStatus));
  const machineIsRunningForIcon = machineIsConnectedForIcon && statusRunningStable;
  const machineIsRunningRaw = machineIsConnected && isMachineRunning(currentMachineStatus);
  const statusIconAlt = !machineIsConnected
    ? 'Mất kết nối PLC'
    : getMachineStatusLabel(currentMachineStatus);

  useEffect(() => {
    const ref = new Date();
    setChartViewMode(CHART_VIEW_MODES.day);
    setSelectedMonth(ref.getMonth() + 1);
    setSelectedYear(ref.getFullYear());
    const defaultRange = getDefaultRangeDates(ref);
    setRangeFrom(defaultRange.from);
    setRangeTo(defaultRange.to);
    setRangeDisplay(RANGE_DISPLAY_MODES.day);
    setStatusRangeMode('1h');
    setStatusFrom(null);
    setStatusTo(null);
    setElecRangeMode('1h');
    setElecFrom(null);
    setElecTo(null);
  }, [machine_id]);

  const availableChartYears = useMemo(
    () => getYearKeysFromData(rawData, allErrorsMachine, new Date(now)),
    [rawData, allErrorsMachine, now],
  );

  const chartSelection = useMemo(
    () => ({
      year: selectedYear,
      month: selectedMonth,
      availableYears: availableChartYears,
      dateFrom: rangeFrom,
      dateTo: rangeTo,
      rangeDisplay,
    }),
    [selectedYear, selectedMonth, availableChartYears, rangeFrom, rangeTo, rangeDisplay],
  );

  const chartXTickMode = toErrorChartTickMode(chartViewMode, chartSelection);
  const chartCategoryPrefix = getChartCategoryPrefix(chartViewMode, chartSelection);

  const handoverDate = useMemo(
    () => parseHandoverDate(machineInfo?.information),
    [machineInfo?.information],
  );

  useEffect(() => {
    const time = buildTimeSeries(rawData, chartViewMode, chartSelection);

    setChartLabels((prev) => (chartSeriesEqual(prev, time.labels) ? prev : time.labels));
    setTimeRunValues((prev) => (chartSeriesEqual(prev, time.timeRun) ? prev : time.timeRun));
    setEnergyKwhValues((prev) =>
      chartSeriesEqual(prev, time.energyKwh) ? prev : time.energyKwh,
    );

    const eff = buildEfficiencySeries(rawData, chartViewMode, chartSelection);
    setEfficiencyLabels((prev) =>
      chartSeriesEqual(prev, eff.labels) ? prev : eff.labels,
    );
    setUtilizationChartValues((prev) =>
      chartSeriesEqual(prev, eff.utilization) ? prev : eff.utilization,
    );
    setUsageChartValues((prev) =>
      chartSeriesEqual(prev, eff.usage) ? prev : eff.usage,
    );
  }, [rawData, chartViewMode, chartSelection]);

  const isConnected = (lastUpdated) => isMachineConnected(lastUpdated, now);

  useEffect(() => {
    const { from, to, isLive } = resolveStatusRange(
      statusRangeMode,
      statusFrom,
      statusTo,
      now,
    );
    const liveStatus = isLive
      ? (statusMachine?.status ?? machineInfo?.status ?? null)
      : null;
    const statusTimeline = buildStatusTimelineChartSeconds(
      rawMachineData,
      from,
      to,
      STATUS_CHART_INTERVAL_SECONDS,
      liveStatus,
    );

    setStatusChartTimestamps((prev) =>
      chartSeriesEqual(prev, statusTimeline.timestamps) ? prev : statusTimeline.timestamps,
    );
    setStatusDataValuesChart3((prev) =>
      chartSeriesEqual(prev, statusTimeline.values) ? prev : statusTimeline.values,
    );
  }, [
    rawMachineData,
    now,
    statusRangeMode,
    statusFrom,
    statusTo,
    statusMachine?.status,
    machineInfo?.status,
  ]);

  const openStatusRangeModal = () => {
    const { from, to } = resolveStatusRange(statusRangeMode, statusFrom, statusTo, Date.now());
    setTempStatusFrom(from);
    setTempStatusTo(to);
    setShowStatusRangeModal(true);
  };

  const applyCustomStatusRange = () => {
    if (!tempStatusFrom || !tempStatusTo) {
      window.alert('Vui lòng chọn đủ thời gian bắt đầu và kết thúc');
      return false;
    }
    if (tempStatusFrom.getTime() > tempStatusTo.getTime()) {
      window.alert('Thời gian bắt đầu phải trước thời gian kết thúc');
      return false;
    }
    if (!isSameLocalDay(tempStatusFrom, tempStatusTo)) {
      window.alert('Chỉ được chọn trong cùng một ngày (00:00–23:59).');
      return false;
    }
    setStatusFrom(tempStatusFrom);
    setStatusTo(tempStatusTo);
    setStatusRangeMode('custom');
    return true;
  };

  const openElecRangeModal = () => {
    const { from, to } = resolveStatusRange(elecRangeMode, elecFrom, elecTo, Date.now());
    setTempElecFrom(from);
    setTempElecTo(to);
    setShowElecRangeModal(true);
  };

  const applyCustomElecRange = () => {
    if (!tempElecFrom || !tempElecTo) {
      window.alert('Vui lòng chọn đủ thời gian bắt đầu và kết thúc');
      return false;
    }
    if (tempElecFrom.getTime() > tempElecTo.getTime()) {
      window.alert('Thời gian bắt đầu phải trước thời gian kết thúc');
      return false;
    }
    if (!isSameLocalDay(tempElecFrom, tempElecTo)) {
      window.alert('Chỉ được chọn trong cùng một ngày (00:00–23:59).');
      return false;
    }
    setElecFrom(tempElecFrom);
    setElecTo(tempElecTo);
    setElecRangeMode('custom');
    return true;
  };

  // Biểu đồ công suất — khoảng chọn, mẫu đều 10 giây
  useEffect(() => {
    const { from, to, isLive } = resolveStatusRange(
      elecRangeMode,
      elecFrom,
      elecTo,
      now,
    );
    const electrical = buildPowerCurrentTimelineChart(
      rawMachineData,
      from,
      to,
      10,
      isLive ? powerKw : null,
      null,
    );
    setElecChartTimestamps((prev) =>
      chartSeriesEqual(prev, electrical.timestamps) ? prev : electrical.timestamps,
    );
    setPowerChartValues((prev) =>
      chartSeriesEqual(prev, electrical.power) ? prev : electrical.power,
    );
  }, [
    rawMachineData,
    now,
    elecRangeMode,
    elecFrom,
    elecTo,
    powerKw,
  ]);

  const handleDelete = async () => {
    const name = machineInfo?.machine_name || machine_id;
    if (!window.confirm(`Bạn có chắc muốn xoá máy "${name}"?`)) return;

    setDeleting(true);
    try {
      await axios.delete(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}`,
        { headers: authHeaders() },
      );
      navigate('/mida/cnc');
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xoá máy. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveInformation = async (payload) => {
    setSavingInformation(true);
    try {
      await saveMachineInformation(payload);
    } finally {
      setSavingInformation(false);
    }
  };

  const imageSrc = machineInfo?.image_url ? `${BASE_URL}${machineInfo.image_url}` : null;
  const machineNotFound = !isLoading && !machineInfo;

  return (
    <div className="mida-page mida-page--detail">
      <MidaNavbar />

      <div className="mida-page__body d-flex flex-nowrap mida-page__body--detail">
        <MidaMachineSidebar
          machines={machines}
          navigate={navigate}
          width={width}
          selectedMachineId={machine_id}
        />

        {/* Main Content */}
        <div className="flex-grow-1 mida-detail__main">
          {machineNotFound ? (
            <div className="mida-empty" style={{ padding: '2rem 1rem' }}>
              <h2>Không tìm thấy máy CNC</h2>
              <p>Máy &quot;{machine_id}&quot; không tồn tại hoặc bạn không có quyền xem.</p>
            </div>
          ) : (
          <>
          {/* Phần thông tin máy + ảnh + biểu đồ trạng thái */}
          <div className="row flex-shrink-0 machine-top-panel machine-top-panel--mida">
            <div className="machine-top-panel__col-left">
              <div className="row machine-top-panel__main-row">
                {/* Thông số máy */}
                <div className="col-12 machine-top-panel__stats-col">
                  <div className="row machine-top-panel__stats-grid-row machine-top-panel__name-row">
                    <div className="col-8">
                      <div
                        className="border bg-white rounded text-center fw-semibold shadow d-flex flex-column justify-content-center text-brand machine-top-panel__name"
                        style={{
                          letterSpacing: '0.5px',
                          padding: '4px 8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                        onClick={() => setModals((prev) => ({ ...prev, machineInfo: true }))}
                        title="Thông tin chi tiết"
                      >
                        <AutoFitMachineName
                          text={machineInfo?.machine_name || machine_id}
                          maxFontSize={handoverDate ? 20 : 24}
                          minFontSize={11}
                          style={{ width: '100%', flex: '1 1 auto', minHeight: 0 }}
                        />
                        {handoverDate ? (
                          <div className="machine-top-panel__handover-date" title={`Ngày bàn giao: ${handoverDate}`}>
                            Ngày bàn giao: {handoverDate}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-4">
                      <div
                        className={`border rounded shadow w-100 machine-top-panel__status-icon${
                          machineIsRunningForIcon
                            ? ' machine-top-panel__status-icon--running'
                            : ' machine-top-panel__status-icon--stopped'
                        }`}
                      >
                        <MachineStatusIconPanel
                          isRunning={machineIsRunningForIcon}
                          isConnected={machineIsConnectedForIcon}
                          title={statusIconAlt}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row machine-top-panel__stats-grid-row machine-top-panel__stat-row">
                    <div className="col-8 machine-top-panel__stat-pair">
                      <div className="machine-top-panel__stat-pair-inner">
                        <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box h-100">
                          <p className="fw-semibold mb-0 text-brand">ĐIỆN NĂNG TIÊU THỤ LŨY KẾ</p>
                          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
                            <h5 className="m-0 machine-top-panel__stat-value">
                              {(shootMachine || 0).toLocaleString('en-US', {
                                maximumFractionDigits: 3,
                              })}{' '}
                              kWh
                            </h5>
                          </div>
                        </div>

                        <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box h-100">
                          <p className="fw-semibold mb-0 text-brand">THỜI GIAN MỞ MÁY LŨY KẾ</p>
                          <div className="flex-grow-1 d-flex align-items-center justify-content-center px-1">
                            <CumulativeRuntimeDisplay
                              serverSeconds={totalTimeOnSeconds}
                              isRunning={machineIsConnected}
                              machineId={`${machine_id}-on`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-4">
                      <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box">
                        <p className="fw-semibold mb-0 text-brand">THỜI GIAN CẮT GỌT LŨY KẾ</p>
                        <div className="flex-grow-1 d-flex align-items-center justify-content-center px-1">
                          <CumulativeRuntimeDisplay
                            serverSeconds={totalTimeRunningSeconds}
                            isRunning={machineIsRunningRaw}
                            machineId={`${machine_id}-run`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ảnh máy + biểu đồ trạng thái */}
            <div className="machine-top-panel__center">
              <div className="machine-top-panel__image-col machine-top-panel__image-col--mid">
                <div className="bg-white border rounded shadow w-100 machine-top-panel__image-wrap">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      className="w-100 h-100"
                      style={{ objectFit: 'cover' }}
                      alt="Machine"
                    />
                  ) : (
                    <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                      <i className="bi bi-image" style={{ fontSize: '2rem' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="machine-top-panel__status-wrap d-flex min-h-0">
                <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--status machine-top-panel__status-chart w-100">
                  <div className="chart-title-brand machine-chart-head mida-status-chart-head">
                    <div>BIỂU ĐỒ TRẠNG THÁI</div>
                    <div className="mida-status-range" role="group" aria-label="Khoảng thời gian trạng thái">
                      {STATUS_RANGE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`mida-status-range__btn${
                            statusRangeMode === p.id ? ' is-active' : ''
                          }`}
                          onClick={() => setStatusRangeMode(p.id)}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`mida-status-range__btn mida-status-range__btn--custom${
                          statusRangeMode === 'custom' ? ' is-active' : ''
                        }`}
                        onClick={openStatusRangeModal}
                        title="Chọn khoảng thời gian tùy chỉnh"
                      >
                        Tuỳ chọn
                      </button>
                    </div>
                  </div>
                  <div className="machine-chart-plot">
                    <div className="machine-chart-plot-inner">
                      <MidaStatusChart
                        key={`${statusRangeMode}-${statusFrom?.getTime?.() ?? ''}-${statusTo?.getTime?.() ?? ''}`}
                        timestamps={statusChartTimestamps}
                        statusValues={statusDataValuesChart3}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chọn thời gian — cùng độ rộng cột điện / date panel */}
            <div className="machine-top-panel__date-col d-flex min-h-0">
              <MachineTimeRangePanel
                viewMode={chartViewMode}
                onViewModeChange={setChartViewMode}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                availableYears={availableChartYears}
                pickerYear={selectedYear}
              />
            </div>
          </div>

          {/* Phần biểu đồ — lưới 2 hàng: hàng dưới time & power cùng chiều cao */}
          <div className="machine-charts-row machine-charts-row--mida">
            <div className="mida-charts-cell mida-charts-cell--gauges">
              <div className="mida-gauge-pair">
                <MidaGaugeChart
                  value={performanceMachine}
                  label="HIỆU SUẤT SỬ DỤNG"
                  variant="performance"
                  formula="Thời gian chạy / Thời gian đưa máy vào hoạt động × 100%"
                />
                <MidaGaugeChart
                  value={utilizationMachine}
                  label="HIỆU SUẤT VẬN HÀNH"
                  variant="utilization"
                  formula="Thời gian chạy / Thời gian bật máy × 100%"
                />
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--efficiency">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--status">
                <div className="chart-title-brand machine-chart-head">
                  <div>BIỂU ĐỒ HIỆU SUẤT</div>
                </div>
                <div className="machine-chart-plot">
                  <div className="machine-chart-plot-inner">
                    <MidaEfficiencyChart
                      labels={efficiencyLabels}
                      utilizationValues={utilizationChartValues}
                      usageValues={usageChartValues}
                      xTickMode={chartXTickMode}
                      categoryPrefix={chartCategoryPrefix}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--elec">
              <MidaElectricalCards
                voltage={voltageAvg}
                current={currentAvg}
                powerKw={powerKw}
              />
            </div>

            <div className="mida-charts-cell mida-charts-cell--time">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--time">
                <div className="chart-title-brand machine-chart-head">
                  <div>BIỂU ĐỒ THỜI GIAN & ĐIỆN NĂNG</div>
                </div>
                <div className="machine-chart-plot">
                  <div className="machine-chart-plot-inner">
                    <LineChart_TimeOn
                      labels={chartLabels}
                      line3={timeRunValues}
                      energyKwhValues={energyKwhValues}
                      xTickMode={chartXTickMode}
                      categoryPrefix={chartCategoryPrefix}
                      timeSeriesType="line"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--power">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--tall">
                <div className="chart-title-brand machine-chart-head mida-status-chart-head">
                  <div>BIỂU ĐỒ CÔNG SUẤT</div>
                  <div className="mida-status-range" role="group" aria-label="Khoảng thời gian công suất">
                    {STATUS_RANGE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`mida-status-range__btn${
                          elecRangeMode === p.id ? ' is-active' : ''
                        }`}
                        onClick={() => setElecRangeMode(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`mida-status-range__btn mida-status-range__btn--custom${
                        elecRangeMode === 'custom' ? ' is-active' : ''
                      }`}
                      onClick={openElecRangeModal}
                      title="Chọn khoảng thời gian tùy chỉnh"
                    >
                      Tuỳ chọn
                    </button>
                  </div>
                </div>
                <div className="machine-chart-plot">
                  <div className="machine-chart-plot-inner">
                    <MidaPowerCurrentChart
                      key={`${elecRangeMode}-${elecFrom?.getTime?.() ?? ''}-${elecTo?.getTime?.() ?? ''}`}
                      timestamps={elecChartTimestamps}
                      powerValues={powerChartValues}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      <MachineInfoModal
        open={modals.machineInfo}
        machineInfo={machineInfo || {}}
        isConnected={isConnected}
        onClose={() => setModals((prev) => ({ ...prev, machineInfo: false }))}
        onBoot={isAdmin ? handleBootData : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
        deleting={deleting}
        onSaveInformation={handleSaveInformation}
        savingInformation={savingInformation}
        overlayClassName="mida-modal-overlay"
        panelClassName="mida-modal-panel"
      />

      <TimeRangeModal
        open={showStatusRangeModal}
        title="Khoảng thời gian trạng thái"
        fromDate={tempStatusFrom}
        toDate={tempStatusTo}
        onFromDateChange={setTempStatusFrom}
        onToDateChange={setTempStatusTo}
        showTimeSelect
        sameCalendarDayOnly
        overlayClassName="mida-modal-overlay"
        panelClassName="mida-modal-panel"
        onCancel={() => setShowStatusRangeModal(false)}
        onUpdate={applyCustomStatusRange}
        onClose={() => setShowStatusRangeModal(false)}
      />

      <TimeRangeModal
        open={showElecRangeModal}
        title="Khoảng thời gian công suất"
        fromDate={tempElecFrom}
        toDate={tempElecTo}
        onFromDateChange={setTempElecFrom}
        onToDateChange={setTempElecTo}
        showTimeSelect
        sameCalendarDayOnly
        overlayClassName="mida-modal-overlay"
        panelClassName="mida-modal-panel"
        onCancel={() => setShowElecRangeModal(false)}
        onUpdate={applyCustomElecRange}
        onClose={() => setShowElecRangeModal(false)}
      />

      {width < 1200 && (
        <div
          className="offcanvas offcanvas-start"
          tabIndex="-1"
          id="offcanvasMidaMachinesList"
          ref={offcanvasRef}
          style={{ width: '265px' }}
          aria-labelledby="offcanvasMidaMachinesListLabel"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
        >
          <div className="offcanvas-header py-1 px-2 mt-1" style={{ marginBottom: '-8px' }}>
            <button
              type="button"
              className="btn-close ms-auto"
              data-bs-dismiss="offcanvas"
              aria-label="Close"
              style={{ scale: '0.9' }}
            />
          </div>
          <div className="offcanvas-body px-2 pt-1">
            <MidaMachineSidebarMobile
              machines={machines}
              navigate={navigate}
              selectedMachineId={machine_id}
            />
          </div>
        </div>
      )}

      {isLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
