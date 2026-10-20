import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';

import CumulativeRuntimeDisplay from '../../components/machine/CumulativeRuntimeDisplay';
import MachineInfoModal from '../../components/machine/MachineInfoModal';
import MachineStatusIconPanel from '../../components/machine/MachineStatusIconPanel';
import MachineTimeRangePanel from '../../components/machine/MachineTimeRangePanel';
import TimeRangeModal from '../../components/machine/TimeRangeModal';
import AutoFitMachineName from '../../components/machine/AutoFitMachineName';

import MidaNavbar from '../../components/mida/MidaNavbar';
import MidaMachineSidebar from '../../components/mida/MidaMachineSidebar';
import MidaMachineSidebarMobile from '../../components/mida/MidaMachineSidebarMobile';
import MidaElectricalCards from '../../components/mida/MidaElectricalCards';
import MidaPowerCurrentChart from '../../components/mida/MidaPowerCurrentChart';
import MidaRunStopPieChart from '../../components/mida/MidaRunStopPieChart';
import MidaRunStopStackedBar from '../../components/mida/MidaRunStopStackedBar';
import MidaTimeEnergyWithTotal from '../../components/mida/MidaTimeEnergyWithTotal';
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
  buildRunStopPctSeries,
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

/** Cửa sổ raw cho status + spindle (không kéo theo tháng/năm). */
function computeLiveTelemetryFromIso({ statusRangeMode, statusFrom, nowMinute }) {
  const nowMs = nowMinute * 60_000;
  let earliest = nowMs - 24 * 60 * 60 * 1000;

  if (statusRangeMode === 'custom' && statusFrom) {
    earliest = Math.min(earliest, new Date(statusFrom).getTime());
  } else if (statusRangeMode === 'today') {
    const start = new Date(nowMs);
    start.setHours(0, 0, 0, 0);
    earliest = Math.min(earliest, start.getTime());
  } else {
    const preset = STATUS_RANGE_PRESETS.find((p) => p.id === statusRangeMode);
    if (preset?.minutes) {
      earliest = Math.min(earliest, nowMs - preset.minutes * 60_000);
    }
  }

  earliest -= 5 * 60_000;
  return new Date(earliest).toISOString();
}

/** Cửa sổ daily aggregate cho biểu đồ ngày→năm (nhẹ: ~365 dòng/năm). */
function computeDailyTelemetryFromIso({ selectedYear, chartViewMode, nowMinute }) {
  const nowMs = nowMinute * 60_000;
  const currentYear = new Date(nowMs).getFullYear();
  // Mode năm: lấy nhiều năm; còn lại: cả năm đang chọn (đổi tháng/tuần không refetch)
  const earliest = chartViewMode === CHART_VIEW_MODES.year
    ? new Date(currentYear - 10, 0, 1).getTime()
    : new Date(selectedYear, 0, 1).getTime();
  return new Date(Math.min(earliest, nowMs) - 5 * 60_000).toISOString();
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
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [rangeFrom, setRangeFrom] = useState(() => getDefaultRangeDates().from);
  const [rangeTo, setRangeTo] = useState(() => getDefaultRangeDates().to);
  const [rangeDisplay, setRangeDisplay] = useState(RANGE_DISPLAY_MODES.day);
  const [statusRangeMode, setStatusRangeMode] = useState('1h');
  const [statusFrom, setStatusFrom] = useState(null);
  const [statusTo, setStatusTo] = useState(null);

  const nowMinute = Math.floor(now / 60_000);
  const liveFrom = useMemo(
    () =>
      computeLiveTelemetryFromIso({
        statusRangeMode,
        statusFrom,
        nowMinute,
      }),
    [statusRangeMode, statusFrom, nowMinute],
  );

  const dailyFrom = useMemo(
    () =>
      computeDailyTelemetryFromIso({
        selectedYear,
        chartViewMode,
        nowMinute,
      }),
    [selectedYear, chartViewMode, nowMinute],
  );

  const hourRange = useMemo(() => {
    if (chartViewMode !== CHART_VIEW_MODES.hour) {
      return { hourFrom: null, hourTo: null };
    }
    const from = new Date(selectedYear, selectedMonth - 1, selectedDay, 0, 0, 0, 0);
    const to = new Date(selectedYear, selectedMonth - 1, selectedDay, 23, 59, 59, 999);
    return { hourFrom: from.toISOString(), hourTo: to.toISOString() };
  }, [chartViewMode, selectedYear, selectedMonth, selectedDay]);

  const machineData = useMidaMachineData(machine_id, {
    liveFrom,
    dailyFrom,
    hourFrom: hourRange.hourFrom,
    hourTo: hourRange.hourTo,
  });
  const {
    machineInfo,
    rawMachineData,
    hourTelemetryRows,
    rawData,
    statusMachine,
    allErrorsMachine,
    machines,
    totalTimeOnSeconds,
    totalTimeRunningSeconds,
    shootMachine,
    powerKw,
    voltageAvg,
    currentAvg,
    isLoading,
    chartRangeLoading,
    handleBootData,
    saveMachineInformation,
  } = machineData;

  const [deleting, setDeleting] = useState(false);
  const [savingInformation, setSavingInformation] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const offcanvasRef = useRef(null);
  const [offcanvasInstance, setOffcanvasInstance] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const showMachineListToggle = width < 1200;

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!showMachineListToggle || !offcanvasRef.current) {
      setOffcanvasInstance(null);
      setIsOpen(false);
      return undefined;
    }

    const el = offcanvasRef.current;
    const instance = Offcanvas.getOrCreateInstance(el);
    setOffcanvasInstance(instance);

    const handleShown = () => setIsOpen(true);
    const handleHidden = () => setIsOpen(false);
    el.addEventListener('shown.bs.offcanvas', handleShown);
    el.addEventListener('hidden.bs.offcanvas', handleHidden);

    return () => {
      el.removeEventListener('shown.bs.offcanvas', handleShown);
      el.removeEventListener('hidden.bs.offcanvas', handleHidden);
    };
  }, [showMachineListToggle]);

  const toggleMachineList = () => {
    if (!offcanvasRef.current) return;
    const instance = Offcanvas.getOrCreateInstance(offcanvasRef.current);
    setOffcanvasInstance(instance);
    if (isOpen) instance.hide();
    else instance.show();
  };


  const [powerChartValues, setPowerChartValues] = useState([]);
  const [elecChartTimestamps, setElecChartTimestamps] = useState([]);
  const [statusChartTimestamps, setStatusChartTimestamps] = useState([]);
  const [statusDataValuesChart3, setStatusDataValuesChart3] = useState([]);
  const [showStatusRangeModal, setShowStatusRangeModal] = useState(false);
  const [tempStatusFrom, setTempStatusFrom] = useState(null);
  const [tempStatusTo, setTempStatusTo] = useState(null);
  const [modals, setModals] = useState({
    machineInfo: false,
  });

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
    ? 'Chưa kết nối PLC'
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
  }, [machine_id]);

  // Không phụ thuộc `now` (tick 3s) — tránh rebuild chart vô ích
  const availableChartYears = useMemo(
    () => getYearKeysFromData(rawData, allErrorsMachine, new Date()),
    [rawData, allErrorsMachine],
  );

  const chartSelection = useMemo(() => {
    const base = {
      year: selectedYear,
      month: selectedMonth,
      day: selectedDay,
      availableYears: availableChartYears,
      dateFrom: rangeFrom,
      dateTo: rangeTo,
      rangeDisplay,
    };
    // Mode giờ: raw đúng 1 ngày (không dùng cửa sổ status 1h/24h)
    if (chartViewMode === CHART_VIEW_MODES.hour) {
      return { ...base, telemetryRows: hourTelemetryRows };
    }
    return base;
  }, [
    selectedYear,
    selectedMonth,
    selectedDay,
    availableChartYears,
    rangeFrom,
    rangeTo,
    rangeDisplay,
    chartViewMode,
    chartViewMode === CHART_VIEW_MODES.hour ? hourTelemetryRows : null,
  ]);

  const chartXTickMode = toErrorChartTickMode(chartViewMode, chartSelection);
  const chartCategoryPrefix = getChartCategoryPrefix(chartViewMode, chartSelection);

  const handoverDate = useMemo(
    () => parseHandoverDate(machineInfo?.information),
    [machineInfo?.information],
  );

  // Memo series — đổi tháng chỉ filter client, không setState hàng loạt
  const timeChartSeries = useMemo(
    () => buildTimeSeries(rawData, chartViewMode, chartSelection),
    [rawData, chartViewMode, chartSelection],
  );
  const runStopChartSeries = useMemo(
    () => buildRunStopPctSeries(rawData, chartViewMode, chartSelection),
    [rawData, chartViewMode, chartSelection],
  );

  const chartLabels = timeChartSeries.labels || [];
  const timeRunValues = timeChartSeries.timeRun || [];
  const energyKwhValues = timeChartSeries.energyKwh || [];
  const runStopBarLabels = runStopChartSeries.labels || [];
  const runStopCutPctValues = runStopChartSeries.cutPct || [];
  const runStopIdlePctValues = runStopChartSeries.stopPct || [];
  const runStopCutHourValues = runStopChartSeries.cutHours || [];
  const runStopIdleHourValues = runStopChartSeries.stopHours || [];

  const isConnected = (lastUpdated) => isMachineConnected(lastUpdated, now);

  // Live charts: làm tròn 10s để khớp bucket, giảm rebuild mỗi 3s
  const nowBucket10s = Math.floor(now / 10_000);

  useEffect(() => {
    const nowMs = nowBucket10s * 10_000;
    const { from, to, isLive } = resolveStatusRange(
      statusRangeMode,
      statusFrom,
      statusTo,
      nowMs,
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
    nowBucket10s,
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

  // Biểu đồ công suất — cùng khoảng thời gian với biểu đồ trạng thái
  useEffect(() => {
    const nowMs = nowBucket10s * 10_000;
    const { from, to, isLive } = resolveStatusRange(
      statusRangeMode,
      statusFrom,
      statusTo,
      nowMs,
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
    nowBucket10s,
    statusRangeMode,
    statusFrom,
    statusTo,
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

      {chartRangeLoading ? (
        <div className="mida-page-loading-overlay" role="status" aria-live="polite">
          <div className="mida-page-loading-overlay__card">
            <div className="spinner-border text-danger" aria-hidden="true" />
            <div className="mida-page-loading-overlay__text">Đang tải dữ liệu biểu đồ…</div>
          </div>
        </div>
      ) : null}

      {showMachineListToggle && !isOpen && (
        <button
          type="button"
          className="mida-sidebar-pull"
          onClick={toggleMachineList}
          aria-label="Mở danh sách máy"
          aria-controls="offcanvasMidaMachinesList"
          title="Danh sách máy"
        >
          <span className="mida-sidebar-pull__grip" aria-hidden="true" />
          <i className="bi bi-chevron-right mida-sidebar-pull__icon" aria-hidden="true" />
        </button>
      )}

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

            {/* Biểu đồ trạng thái */}
            <div className="machine-top-panel__center">
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
                onMonthChange={(month) => {
                  setSelectedMonth(month);
                  const maxDay = new Date(selectedYear, month, 0).getDate();
                  setSelectedDay((d) => Math.min(d, maxDay));
                }}
                selectedYear={selectedYear}
                onYearChange={(year) => {
                  setSelectedYear(year);
                  const maxDay = new Date(year, selectedMonth, 0).getDate();
                  setSelectedDay((d) => Math.min(d, maxDay));
                }}
                selectedDay={selectedDay}
                onDayChange={setSelectedDay}
                onDateChange={({ year, month, day }) => {
                  setSelectedYear(year);
                  setSelectedMonth(month);
                  setSelectedDay(day);
                }}
                availableYears={availableChartYears}
                pickerYear={selectedYear}
              />
            </div>
          </div>

          {/* Phần biểu đồ — thứ tự DOM = thứ tự đọc: image+pie → power → time → efficiency → elec */}
          <div className="machine-charts-row machine-charts-row--mida">
            <div className="mida-charts-cell mida-charts-cell--gauges mida-charts-cell--image">
              <div className="mida-gauge-pair">
                <div className="bg-white border rounded shadow w-100 h-100 machine-top-panel__image-wrap mida-detail__image-card">
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
                <MidaRunStopPieChart
                  runSeconds={totalTimeRunningSeconds}
                  onSeconds={totalTimeOnSeconds}
                />
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--power">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--tall">
                <div className="chart-title-brand machine-chart-head">
                  <div>CÔNG SUẤT TRỤC SPINDLE</div>
                </div>
                <div className="machine-chart-plot">
                  <div className="machine-chart-plot-inner">
                    <MidaPowerCurrentChart
                      key={`${statusRangeMode}-${statusFrom?.getTime?.() ?? ''}-${statusTo?.getTime?.() ?? ''}`}
                      timestamps={elecChartTimestamps}
                      powerValues={powerChartValues}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--time">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--time">
                <MidaTimeEnergyWithTotal
                  labels={chartLabels}
                  timeRunValues={timeRunValues}
                  energyKwhValues={energyKwhValues}
                  xTickMode={chartXTickMode}
                  categoryPrefix={chartCategoryPrefix}
                  timeSeriesType="line"
                  timeSeriesLabel="Thời gian cắt gọt (giờ)"
                />
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--efficiency">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--status">
                <MidaRunStopStackedBar
                  labels={runStopBarLabels}
                  cutPctValues={runStopCutPctValues}
                  stopPctValues={runStopIdlePctValues}
                  cutHourValues={runStopCutHourValues}
                  stopHourValues={runStopIdleHourValues}
                  xTickMode={chartXTickMode}
                  categoryPrefix={chartCategoryPrefix}
                />
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--elec">
              <MidaElectricalCards
                voltage={voltageAvg}
                current={currentAvg}
                powerKw={powerKw}
              />
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
        title="Chọn khoảng thời gian"
        fromDate={tempStatusFrom}
        toDate={tempStatusTo}
        onFromDateChange={setTempStatusFrom}
        onToDateChange={setTempStatusTo}
        showTimeSelect
        sameCalendarDayOnly
        overlayClassName="mida-modal-overlay"
        panelClassName="mida-modal-panel mida-modal-panel--time"
        onCancel={() => setShowStatusRangeModal(false)}
        onUpdate={applyCustomStatusRange}
        onClose={() => setShowStatusRangeModal(false)}
      />

      {width < 1200 && (
        <div
          className="offcanvas offcanvas-start mida-machines-offcanvas"
          tabIndex="-1"
          id="offcanvasMidaMachinesList"
          ref={offcanvasRef}
          aria-labelledby="offcanvasMidaMachinesListLabel"
          data-bs-backdrop="true"
          data-bs-keyboard="true"
        >
          <div className="offcanvas-header mida-machines-offcanvas__header">
            <h5 className="machine-tree-sidebar__title" id="offcanvasMidaMachinesListLabel">
              Danh sách máy CNC
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="offcanvas"
              aria-label="Đóng"
            />
          </div>
          <div className="offcanvas-body mida-machines-offcanvas__body">
            <MidaMachineSidebarMobile
              machines={machines}
              navigate={navigate}
              selectedMachineId={machine_id}
              onNavigate={() => offcanvasInstance?.hide()}
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
