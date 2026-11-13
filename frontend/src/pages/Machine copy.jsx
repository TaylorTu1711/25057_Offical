
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import BarLineChart_Sanluong from '../components/BarChart';
import LineChart_TimeOn from '../components/BarChart_Thoigian';
import BarChart_LoiTheoNgay from '../components/BarChart_LoiTheoNgay';
import BarChart_AnalysisError from '../components/BarChart_AnalysisError';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate  } from 'react-router-dom';
import AppNavbar from '../components/Navbar';
import PerformanceChart from '../components/PerformanceChart';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../css/Machine.css'
import 'bootstrap-icons/font/bootstrap-icons.css';
import { BASE_URL } from '../config/config';
import MachineTreeSidebar from '../components/MachineTreeSidebar';
import MachineTreeSidebarMobile from '../components/MachineTreeSidebarMobile';
import useMachineData from '../hooks/useMachineData';
import useNow from '../hooks/useNow';
import useStableMachineRunning from '../hooks/useStableMachineRunning';
import { buildErrorStats } from '../utils/errorStats';
import { POLL_INTERVALS } from '../config/polling';
import {
  getMachineStatusLabel,
  isMachineConnected,
  isMachineRunning,
} from '../utils/machineStatus';
import CumulativeRuntimeDisplay from '../components/machine/CumulativeRuntimeDisplay';
import MachineInfoModal from '../components/machine/MachineInfoModal';
import MachineStatusIconPanel from '../components/machine/MachineStatusIconPanel';
import AnalysisErrorModal from '../components/machine/AnalysisErrorModal';
import MachineTimeRangePanel from '../components/machine/MachineTimeRangePanel';
import TimeRangeModal from '../components/machine/TimeRangeModal';
import AutoFitMachineName from '../components/machine/AutoFitMachineName';
import MidaStatusChart from '../components/mida/MidaStatusChart';
import MidaChartExpand from '../components/mida/MidaChartExpand';
import useResizableTableColumns from '../hooks/useResizableTableColumns';
import ResizableTableHeader from '../components/home/ResizableTableHeader';
import {
  CHART_VIEW_MODES,
  RANGE_DISPLAY_MODES,
  getDefaultRangeDates,
  buildProductivitySeries,
  buildTimeSeries,
  buildErrorSeries,
  filterRowsByChartSelection,
  toErrorChartTickMode,
  getChartCategoryPrefix,
  getYearKeysFromData,
  toLocalDateKey,
} from '../utils/chartViewRange';
import { parseStandardProductivity, parseHandoverDate } from '../utils/parseStandardProductivity';
import { hasInputProductInfo, hasOutputProductInfo } from '../utils/machineProductInfo';
import { buildStatusTimelineChartSeconds } from '../utils/machineStatusTimeline';

const STATUS_RANGE_PRESETS = [
  { id: '1h', label: '1h', minutes: 60 },
  { id: 'today', label: 'Hôm nay' },
];

const PLENMA_STATUS_TICKS = { 1: 'Dừng', 2: 'Chạy' };

/** Độ phân giải bucket trạng thái cố định 10 giây (giống CNC MIDA). */
const STATUS_CHART_INTERVAL_SECONDS = 10;

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function resolveStatusRange(mode, customFrom, customTo, nowMs) {
  const to = new Date(nowMs);
  if (mode === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom);
    let end = new Date(customTo);
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

const ALARM_TABLE_COLUMN_ORDER = ['code', 'description', 'timestamp'];

const ALARM_TABLE_COLUMNS = {
  code: 18,
  description: 52,
  timestamp: 30,
};

const ALARM_TABLE_MIN = {
  code: 12,
  description: 22,
  timestamp: 18,
};

const ERROR_CHART_VIEWS = {
  timeline: 'timeline',
  byType: 'byType',
};

const ERROR_CHART_VIEW_LABELS = {
  [ERROR_CHART_VIEWS.timeline]: 'Thống kê cảnh báo theo thời gian',
  [ERROR_CHART_VIEWS.byType]: 'Thống kê cảnh báo theo loại',
};

const ERROR_DETAIL_TOP_N = 5;

const getRollingFromDate = (minutesAgo, to = new Date()) => {
  const d = new Date(to);
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d;
};

const chartSeriesEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
};


function Machine() {
  const { machine_id } = useParams();
  const navigate = useNavigate();
  const now = useNow(POLL_INTERVALS.connectionTick);
  const machineData = useMachineData(machine_id);
  const {
    rawMachineData,
    rawData,
    statusMachine,
    allErrorsMachine,
    machineInfo,
    totalTimeOnSeconds,
    performanceMachine,
    shootMachine,
    duyTanLocations,
    otherLocations,
    allLocations,
    labelsChartErr,
    tooltipLabelsChartErr,
    dataValuesChartErr,
    isLoading,
    handleBootData,
  } = machineData;

  const {
    widthsPercent: alarmColWidths,
    resizingKey: alarmResizingKey,
    onResizeStart: onAlarmColResizeStart,
  } = useResizableTableColumns(
    'machine_alarm_table_column_percent',
    ALARM_TABLE_COLUMN_ORDER,
    ALARM_TABLE_COLUMNS,
    ALARM_TABLE_MIN,
  );

  const [chartViewMode, setChartViewMode] = useState(CHART_VIEW_MODES.day);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [rangeFrom, setRangeFrom] = useState(() => getDefaultRangeDates().from);
  const [rangeTo, setRangeTo] = useState(() => getDefaultRangeDates().to);
  const [rangeDisplay, setRangeDisplay] = useState(RANGE_DISPLAY_MODES.day);
  const [chartLabels, setChartLabels] = useState([]);
  const [productivityOutputValues, setProductivityOutputValues] = useState([]);
  const [productivityInputValues, setProductivityInputValues] = useState([]);
  const [timeRunValues, setTimeRunValues] = useState([]);
  const [performanceValues, setPerformanceValues] = useState([]);
  const [outputRateValues, setOutputRateValues] = useState([]);
  const [errorChartLabels, setErrorChartLabels] = useState([]);
  const [errorChartValues, setErrorChartValues] = useState([]);
  const [errorChartView, setErrorChartView] = useState(ERROR_CHART_VIEWS.timeline);
  const [statusChartTimestamps, setStatusChartTimestamps] = useState([]);
  const [statusDataValuesChart3, setStatusDataValuesChart3] = useState([]);
  const [statusRangeMode, setStatusRangeMode] = useState('1h');
  const [statusFrom, setStatusFrom] = useState(null);
  const [statusTo, setStatusTo] = useState(null);
  const [showStatusRangeModal, setShowStatusRangeModal] = useState(false);
  const [tempStatusFrom, setTempStatusFrom] = useState(null);
  const [tempStatusTo, setTempStatusTo] = useState(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [selectedMachineData, setSelectedMachineData] = useState([]);
  const [modals, setModals] = useState({
    machineInfo: false,
    errorAnalysis: false,
  });

  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    // cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  



  const currentMachineStatus =
    statusMachine?.status ?? machineInfo?.status ?? null;
  const machineIsConnected = isMachineConnected(
    machineInfo?.last_updated ?? statusMachine?.last_updated,
    now
  );
  const machineIsConnectedForIcon = useStableMachineRunning(machineIsConnected);
  const statusRunningStable = useStableMachineRunning(isMachineRunning(currentMachineStatus));
  const machineIsRunningForIcon = machineIsConnectedForIcon && statusRunningStable;
  const machineIsRunningRaw = machineIsConnected && isMachineRunning(currentMachineStatus);
  const statusIconAlt = !machineIsConnected
    ? 'Chưa kết nối PLC'
    : getMachineStatusLabel(currentMachineStatus);


  const offcanvasRef = useRef(null);
  const [offcanvasInstance, setOffcanvasInstance] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  //ĐÓng mở Offcanvas
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!offcanvasRef.current) return;

      // Nếu chuột ở sát mép trái
      if (e.clientX < 10 && !isOpen) {
        const instance = Offcanvas.getOrCreateInstance(offcanvasRef.current);
        instance.show();
        setOffcanvasInstance(instance);
        setIsOpen(true);

        // Khi offcanvas đóng (do nút close hoặc gọi .hide())
        offcanvasRef.current.addEventListener(
          'hidden.bs.offcanvas',
          () => setIsOpen(false),
          { once: true }
        );
      }

      // Nếu chuột di chuyển ra xa > 100px và đang mở → đóng lại
      if (e.clientX > 400 && isOpen && offcanvasInstance) {
        offcanvasInstance.hide();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen, offcanvasInstance]);

  useEffect(() => {
    setSelectedMachineData([]);
    const ref = new Date();
    setChartViewMode(CHART_VIEW_MODES.day);
    setSelectedMonth(ref.getMonth() + 1);
    setSelectedYear(ref.getFullYear());
    setSelectedDay(ref.getDate());
    const defaultRange = getDefaultRangeDates(ref);
    setRangeFrom(defaultRange.from);
    setRangeTo(defaultRange.to);
    setRangeDisplay(RANGE_DISPLAY_MODES.day);
    setErrorChartView(ERROR_CHART_VIEWS.timeline);
  }, [machine_id]);

  const availableChartYears = useMemo(
    () => getYearKeysFromData(rawData, allErrorsMachine, new Date(now)),
    [rawData, allErrorsMachine, now],
  );

  const chartSelection = useMemo(
    () => ({
      year: selectedYear,
      month: selectedMonth,
      day: selectedDay,
      availableYears: availableChartYears,
      dateFrom: rangeFrom,
      dateTo: rangeTo,
      rangeDisplay,
    }),
    [selectedYear, selectedMonth, selectedDay, availableChartYears, rangeFrom, rangeTo, rangeDisplay],
  );

  const filteredAlarms = useMemo(() => {
    const rows = filterRowsByChartSelection(
      allErrorsMachine,
      chartViewMode,
      chartSelection,
    );
    const sorted = [...rows].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    );
    return sorted.filter(
      (error, index, self) =>
        index === self.findIndex((e) => e.timestamp === error.timestamp),
    );
  }, [allErrorsMachine, chartViewMode, chartSelection]);

  const chartXTickMode = toErrorChartTickMode(chartViewMode, chartSelection);
  const chartCategoryPrefix = getChartCategoryPrefix(chartViewMode, chartSelection);

  const standardProductivity = useMemo(
    () => parseStandardProductivity(machineInfo?.information),
    [machineInfo?.information],
  );

  const handoverDate = useMemo(
    () => parseHandoverDate(machineInfo?.information),
    [machineInfo?.information],
  );

  const errorDetailStats = useMemo(
    () => buildErrorStats(
      filterRowsByChartSelection(allErrorsMachine, chartViewMode, chartSelection),
    ),
    [allErrorsMachine, chartViewMode, chartSelection],
  );

  const hasErrorDetailData = errorDetailStats.dataValues.some((v) => Number(v) > 0);
  const showErrorByType = errorChartView === ERROR_CHART_VIEWS.byType;

  const handleRangeApply = useCallback(({ from, to }) => {
    setRangeFrom(from);
    setRangeTo(to);
  }, []);

  useEffect(() => {
    if (!rawData.length) return;
    const dayKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const dataInDay = rawData.filter(
      (d) => toLocalDateKey(d.timestamp) === dayKey,
    );
    if (!dataInDay.length) {
      setSelectedMachineData(rawData[rawData.length - 1] || []);
      return;
    }
    const latestData = dataInDay.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    , dataInDay[0]);
    setSelectedMachineData(latestData);
  }, [selectedDay, selectedMonth, selectedYear, rawData]);

  useEffect(() => {
    const productivity = buildProductivitySeries(rawData, chartViewMode, chartSelection);
    const time = buildTimeSeries(rawData, chartViewMode, chartSelection);
    const errors = buildErrorSeries(allErrorsMachine, chartViewMode, chartSelection);

    setChartLabels((prev) => (chartSeriesEqual(prev, productivity.labels) ? prev : productivity.labels));
    setProductivityOutputValues((prev) =>
      chartSeriesEqual(prev, productivity.output) ? prev : productivity.output,
    );
    setProductivityInputValues((prev) =>
      chartSeriesEqual(prev, productivity.input) ? prev : productivity.input,
    );
    setTimeRunValues((prev) => (chartSeriesEqual(prev, time.timeRun) ? prev : time.timeRun));
    setPerformanceValues((prev) =>
      chartSeriesEqual(prev, time.performance) ? prev : time.performance,
    );
    setOutputRateValues((prev) =>
      chartSeriesEqual(prev, time.outputRate) ? prev : time.outputRate,
    );
    setErrorChartLabels((prev) => (chartSeriesEqual(prev, errors.labels) ? prev : errors.labels));
    setErrorChartValues((prev) => (chartSeriesEqual(prev, errors.values) ? prev : errors.values));
  }, [rawData, allErrorsMachine, chartViewMode, chartSelection]);

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
      window.alert('Khoảng tùy chọn chỉ trong cùng một ngày');
      return false;
    }
    setStatusFrom(tempStatusFrom);
    setStatusTo(tempStatusTo);
    setStatusRangeMode('custom');
    return true;
  };

  useEffect(() => {
    setStatusRangeMode('1h');
    setStatusFrom(null);
    setStatusTo(null);
  }, [machine_id]);

  return (
   <div className="app-page-bg" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
    <AppNavbar />

    <div className="app-page-bg d-flex flex-nowrap gap-1" style={{ 
      fontFamily: 'Arial, sans-serif', 
      flex: 1, 
      overflow: 'hidden',
      margin: 0,
      height: 'calc(100dvh - 56px)'
    }}>       
      {/* Sidebar - Danh sách máy */}
      {/* {width > 1200 && (
        <div className="col-auto px-2 py-2" style={{ 
          background: "#fff",
          height: '100%',
          overflowY: 'auto',
          width: '250px',
          flexShrink: 0
        }}>
          <h5 style={{
            fontSize: "18px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "rgba(32, 64, 154, 1)",
            whiteSpace: "normal",
            wordWrap: "break-word",
            fontWeight: "bold",
            marginBottom: "12px"
          }}>
            {`Danh sách máy tại ${machineInfo?.location || '---'}`}
          </h5>

          {machines && machines.length > 0 ? (
            <ul className="list-unstyled m-0">
              {machines
                .filter((loc) => loc.location === machineInfo.location)
                .map((loc, index) => (
                  <li
                    key={index}
                    className="mb-1 animate-fadein"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <button
                      className="w-100 text-start d-block px-3 py-2 rounded border-0 bg-transparent menu-item"
                      style={{ fontSize: '14px' }}
                      onClick={() => {
                        navigate(`/machines/${loc.machine_id}`);
                        window.location.reload();
                      }}
                    >
                      {loc.machine_name}
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted px-3">Không có máy nào tại vị trí này.</p>
          )}
        </div>
      )} */}

      <MachineTreeSidebar
        machines={allLocations} // Tất cả máy
        machineInfo={machineInfo}
        navigate={navigate}
        width={width}
        selectedMachineId={machineInfo?.machine_id}
        duyTanLocations={duyTanLocations}
        otherLocations={otherLocations}
      />

      {/* Main Content */}
      <div className="flex-grow-1 px-0 py-0 mt-1" style={{ 
        height: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {/* Phần thông tin máy và cảnh báo — căn cột với hàng biểu đồ (xl-6 | xl-6) */}
        <div className="row g-1 flex-shrink-0 machine-top-panel">
          <div className="col-12 col-xl-6 machine-top-panel__col-left">
            <div className="row g-1 machine-top-panel__main-row">
              {/* Thông số máy — bên trái */}
              <div className="col-8 machine-top-panel__stats-col">
                <div className="row g-1 machine-top-panel__stats-grid-row machine-top-panel__name-row">
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
                        text={machineInfo?.machine_name}
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

                <div className="row g-1 machine-top-panel__stats-grid-row machine-top-panel__stat-row">
                  <div className="col-8 machine-top-panel__stat-pair">
                    <div className="row g-1 machine-top-panel__stat-pair-inner">
                      <div className="col-6">
                        <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box machine-top-panel__stat-box--performance">
                          <p className="fw-semibold mb-0 text-brand">HIỆU SUẤT SỬ DỤNG</p>
                          {selectedMachineData ? (
                            <div className="d-flex justify-content-center align-items-center machine-top-panel__perf-inner">
                              <PerformanceChart key={machine_id} performance={performanceMachine} />
                            </div>
                          ) : (
                            <h5 className="m-0 text-dark">N/A</h5>
                          )}
                        </div>
                      </div>

                      <div className="col-6">
                        <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box">
                          <p className="fw-semibold mb-0 text-brand">
                            {machineInfo?.output_unit === 'tấn' ? 'SẢN LƯỢNG LŨY KẾ' : 'SHOOT'}
                          </p>
                          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
                            <h5 className="m-0 machine-top-panel__stat-value">
                              {selectedMachineData
                                ? `${shootMachine.toLocaleString('en-US')}${
                                    machineInfo?.output_unit?.trim().toLowerCase() === 'tấn'
                                      ? ` ${machineInfo.output_unit}`
                                      : ''
                                  }`
                                : 'N/A'}
                            </h5>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-4">
                    <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box">
                      <p className="fw-semibold mb-0 text-brand">THỜI GIAN CHẠY LŨY KẾ</p>
                      <div className="flex-grow-1 d-flex align-items-center justify-content-center px-1">
                        {selectedMachineData ? (
                          <CumulativeRuntimeDisplay
                            serverSeconds={totalTimeOnSeconds}
                            isRunning={machineIsRunningRaw}
                            machineId={machine_id}
                          />
                        ) : (
                          <h5 className="m-0 text-dark">N/A</h5>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ảnh máy — bên phải */}
              <div className="col-4 machine-top-panel__image-col">
                <div className="bg-white border rounded shadow w-100 machine-top-panel__image-wrap">
                  <img
                    src={`${BASE_URL}${machineInfo.image_url}`}
                    className="w-100 h-100"
                    style={{ objectFit: 'cover' }}
                    alt="Machine"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cột cảnh báo + chọn thời gian */}
          <div className="col-12 col-xl-6 machine-top-panel__col-alarms">
            <div className="row g-1 h-100 machine-top-panel__alarms-row">
              <div className="col-9 d-flex min-h-0">
                <div className="card shadow rounded machine-top-panel__alarms machine-top-panel__alarms--list w-100">
                  <div className="d-flex align-items-center mb-2 flex-shrink-0 card-header-row">
                    <h6 className="text-danger fw-bold mb-0">
                      DANH SÁCH CẢNH BÁO
                    </h6>
                  </div>

                  <div className="flex-grow-1" style={{ overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
                    <table className="table table-sm table-bordered mb-0 resizable-table machine-alarm-table">
                      <colgroup>
                        <col style={{ width: alarmColWidths.code }} />
                        <col style={{ width: alarmColWidths.description }} />
                        <col style={{ width: alarmColWidths.timestamp }} />
                      </colgroup>
                      <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <ResizableTableHeader
                            columnKey="code"
                            width={alarmColWidths.code}
                            label="Mã"
                            onResizeStart={onAlarmColResizeStart}
                            isResizing={alarmResizingKey === 'code'}
                          />
                          <ResizableTableHeader
                            columnKey="description"
                            width={alarmColWidths.description}
                            label="Mô tả"
                            onResizeStart={onAlarmColResizeStart}
                            isResizing={alarmResizingKey === 'description'}
                          />
                          <ResizableTableHeader
                            columnKey="timestamp"
                            width={alarmColWidths.timestamp}
                            label="Thời điểm"
                            resizable={false}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlarms.length > 0 ? (
                          filteredAlarms.map((err) => (
                            <tr key={err.id ?? `${err.alarm_id}-${err.timestamp}`}>
                              <td title={String(err.alarm_id)}>
                                {err.alarm_id}
                              </td>
                              <td
                                className="resizable-table__cell--wrap"
                                title={err.alarm_name}
                              >
                                {err.alarm_name}
                              </td>
                              <td title={new Date(err.timestamp).toLocaleString()}>
                                {new Date(err.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="text-center text-muted">
                              Không có lỗi
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="col-3 d-flex min-h-0">
                <MachineTimeRangePanel
                  viewMode={chartViewMode}
                  onViewModeChange={setChartViewMode}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear}
                  selectedDay={selectedDay}
                  onDayChange={setSelectedDay}
                  onDateChange={({ year, month, day }) => {
                    setSelectedYear(year);
                    setSelectedMonth(month);
                    setSelectedDay(day);
                  }}
                  availableYears={availableChartYears}
                  pickerYear={selectedYear}
                  modes={[
                    CHART_VIEW_MODES.hour,
                    CHART_VIEW_MODES.day,
                    CHART_VIEW_MODES.month,
                    CHART_VIEW_MODES.year,
                  ]}
                />
              </div>
            </div>
          </div>             
        </div>

        {/* Phần biểu đồ - FIXED */}
        <div className="row g-1 flex-grow-1 machine-charts-row align-items-stretch" style={{ 
          minHeight: '400px',
          marginBottom: '8px'
        }}>
          {/* Chart 1 - Sản lượng */}
          <div className="col-12 col-xl-6 d-flex flex-column gap-1 machine-charts-stack machine-charts-stack--split machine-charts-stack--equal-pair h-100">
            <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--tall">
              <div className="chart-title-brand machine-chart-head mida-status-chart-head">
                <div>BIỂU ĐỒ SẢN LƯỢNG</div>
                <MidaChartExpand title="BIỂU ĐỒ SẢN LƯỢNG" tone="plenma">
                  <BarLineChart_Sanluong
                    labels={chartLabels}
                    dataValues={productivityOutputValues}
                    lineValues={productivityInputValues}
                    showOutputBar
                    showInputLine={hasInputProductInfo(machineInfo)}
                    barLabel={
                      hasOutputProductInfo(machineInfo)
                        ? `${machineInfo.output_name} (${machineInfo.output_unit})`
                        : 'Sản lượng đầu ra'
                    }
                    lineLabel={
                      hasInputProductInfo(machineInfo)
                        ? `${machineInfo.input_name} (${machineInfo.input_unit})`
                        : ''
                    }
                    xTickMode={chartXTickMode}
                    categoryPrefix={chartCategoryPrefix}
                  />
                </MidaChartExpand>
              </div>

              <div className="machine-chart-plot">
                <div className="machine-chart-plot-inner">
                  <BarLineChart_Sanluong
                    labels={chartLabels}
                    dataValues={productivityOutputValues}
                    lineValues={productivityInputValues}
                    showOutputBar
                    showInputLine={hasInputProductInfo(machineInfo)}
                    barLabel={
                      hasOutputProductInfo(machineInfo)
                        ? `${machineInfo.output_name} (${machineInfo.output_unit})`
                        : 'Sản lượng đầu ra'
                    }
                    lineLabel={
                      hasInputProductInfo(machineInfo)
                        ? `${machineInfo.input_name} (${machineInfo.input_unit})`
                        : ''
                    }
                    xTickMode={chartXTickMode}
                    categoryPrefix={chartCategoryPrefix}
                  />
                </div>
              </div>
            </div>

            {/* Chart 2 - Thời gian */}
            <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--time">
              <div className="chart-title-brand machine-chart-head mida-status-chart-head">
                <div>BIỂU ĐỒ THỜI GIAN & NĂNG SUẤT</div>
                <MidaChartExpand title="BIỂU ĐỒ THỜI GIAN & NĂNG SUẤT" tone="plenma">
                  <LineChart_TimeOn
                    labels={chartLabels}
                    line3={timeRunValues}
                    performanceValues={performanceValues}
                    outputRateValues={outputRateValues}
                    standardProductivity={standardProductivity}
                    xTickMode={chartXTickMode}
                    categoryPrefix={chartCategoryPrefix}
                  />
                </MidaChartExpand>
              </div>

              <div className="machine-chart-plot">
                <div className="machine-chart-plot-inner">
                  <LineChart_TimeOn
                    labels={chartLabels}
                    line3={timeRunValues}
                    performanceValues={performanceValues}
                    outputRateValues={outputRateValues}
                    standardProductivity={standardProductivity}
                    xTickMode={chartXTickMode}
                    categoryPrefix={chartCategoryPrefix}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Thống kê lỗi + Trạng thái */}
          <div className="col-12 col-xl-6 d-flex flex-column gap-1 machine-charts-stack machine-charts-stack--split machine-charts-stack--equal-pair h-100">
            <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--tall">
              <div className="chart-title-brand machine-chart-head machine-chart-head--detail mida-status-chart-head">
                <div
                  className="machine-view-mode-segment machine-view-mode-segment--compact machine-view-mode-segment--alarm-stats"
                  role="tablist"
                  aria-label="Chế độ thống kê cảnh báo"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!showErrorByType}
                    className={`machine-view-mode-segment__btn${
                      !showErrorByType ? ' machine-view-mode-segment__btn--active' : ''
                    }`}
                    onClick={() => setErrorChartView(ERROR_CHART_VIEWS.timeline)}
                  >
                    {ERROR_CHART_VIEW_LABELS[ERROR_CHART_VIEWS.timeline]}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={showErrorByType}
                    className={`machine-view-mode-segment__btn${
                      showErrorByType ? ' machine-view-mode-segment__btn--active' : ''
                    }`}
                    onClick={() => setErrorChartView(ERROR_CHART_VIEWS.byType)}
                  >
                    {ERROR_CHART_VIEW_LABELS[ERROR_CHART_VIEWS.byType]}
                  </button>
                </div>
                <MidaChartExpand
                  tone="plenma"
                  title={
                    showErrorByType
                      ? ERROR_CHART_VIEW_LABELS[ERROR_CHART_VIEWS.byType]
                      : ERROR_CHART_VIEW_LABELS[ERROR_CHART_VIEWS.timeline]
                  }
                  extraHead={(
                    <div
                      className="machine-view-mode-segment machine-view-mode-segment--compact machine-view-mode-segment--alarm-stats"
                      role="tablist"
                      aria-label="Chế độ thống kê cảnh báo"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!showErrorByType}
                        className={`machine-view-mode-segment__btn${
                          !showErrorByType ? ' machine-view-mode-segment__btn--active' : ''
                        }`}
                        onClick={() => setErrorChartView(ERROR_CHART_VIEWS.timeline)}
                      >
                        {ERROR_CHART_VIEW_LABELS[ERROR_CHART_VIEWS.timeline]}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={showErrorByType}
                        className={`machine-view-mode-segment__btn${
                          showErrorByType ? ' machine-view-mode-segment__btn--active' : ''
                        }`}
                        onClick={() => setErrorChartView(ERROR_CHART_VIEWS.byType)}
                      >
                        {ERROR_CHART_VIEW_LABELS[ERROR_CHART_VIEWS.byType]}
                      </button>
                    </div>
                  )}
                >
                  {showErrorByType ? (
                    hasErrorDetailData ? (
                      <BarChart_AnalysisError
                        embedded
                        initialVisibleCount={ERROR_DETAIL_TOP_N}
                        labels={errorDetailStats.labels}
                        displayLabels={errorDetailStats.displayLabels}
                        dataValues={errorDetailStats.dataValues}
                        tooltipLabels={errorDetailStats.tooltipLabels}
                      />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100 w-100 text-muted">
                        Chưa có dữ liệu lỗi
                      </div>
                    )
                  ) : errorChartLabels.length > 0 ? (
                    <BarChart_LoiTheoNgay
                      labels={errorChartLabels}
                      dataValues={errorChartValues}
                      viewMode={chartXTickMode}
                      categoryPrefix={chartCategoryPrefix}
                    />
                  ) : null}
                </MidaChartExpand>
              </div>

              <div className="machine-chart-plot">
                <div className="machine-chart-plot-inner">
                  {showErrorByType ? (
                    hasErrorDetailData ? (
                      <BarChart_AnalysisError
                        embedded
                        initialVisibleCount={ERROR_DETAIL_TOP_N}
                        labels={errorDetailStats.labels}
                        displayLabels={errorDetailStats.displayLabels}
                        dataValues={errorDetailStats.dataValues}
                        tooltipLabels={errorDetailStats.tooltipLabels}
                      />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100 w-100 text-muted">
                        Chưa có dữ liệu lỗi
                      </div>
                    )
                  ) : errorChartLabels.length > 0 ? (
                    <BarChart_LoiTheoNgay
                      labels={errorChartLabels}
                      dataValues={errorChartValues}
                      viewMode={chartXTickMode}
                      categoryPrefix={chartCategoryPrefix}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--status">
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
                  <MidaChartExpand
                    tone="plenma"
                    title="BIỂU ĐỒ TRẠNG THÁI"
                    extraHead={(
                      <div className="mida-status-range" role="group" aria-label="Khoảng thời gian trạng thái">
                        {STATUS_RANGE_PRESETS.map((p) => (
                          <button
                            key={`fs-${p.id}`}
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
                    )}
                  >
                    <MidaStatusChart
                      timestamps={statusChartTimestamps}
                      statusValues={statusDataValuesChart3}
                      statusTicks={PLENMA_STATUS_TICKS}
                    />
                  </MidaChartExpand>
                </div>
              </div>

              <div className="machine-chart-plot">
                <div className="machine-chart-plot-inner">
                  <MidaStatusChart
                    key={`status-${statusRangeMode}-${statusFrom?.getTime?.() ?? ''}-${statusTo?.getTime?.() ?? ''}`}
                    timestamps={statusChartTimestamps}
                    statusValues={statusDataValuesChart3}
                    statusTicks={PLENMA_STATUS_TICKS}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>   
    </div>

    <MachineInfoModal
      open={modals.machineInfo}
      machineInfo={machineInfo}
      isConnected={isConnected}
      onClose={() => setModals((prev) => ({ ...prev, machineInfo: false }))}
      onBoot={handleBootData}
    />

    <AnalysisErrorModal
      open={modals.errorAnalysis}
      labelsChartErr={labelsChartErr}
      tooltipLabelsChartErr={tooltipLabelsChartErr}
      dataValuesChartErr={dataValuesChartErr}
      onClose={() => setModals((prev) => ({ ...prev, errorAnalysis: false }))}
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
      onCancel={() => setShowStatusRangeModal(false)}
      onUpdate={applyCustomStatusRange}
      onClose={() => setShowStatusRangeModal(false)}
    />

    {/* Offcanvas cho mobile */}
    {width < 1200 && (
      <div
        className="offcanvas offcanvas-start"
        tabIndex="-1"
        id="offcanvasMachinesList"
        ref={offcanvasRef}
        style={{ width: '265px' }}
        aria-labelledby="offcanvasMachinesListLabel"
        data-bs-backdrop="static" 
        data-bs-keyboard="false"
      >
        {/* Header: thu nhỏ khoảng cách */}
        <div
          className="offcanvas-header py-1 px-2 mt-1"
          style={{ marginBottom: '-8px' }}
        >
          <button
            type="button"
            className="btn-close ms-auto"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
            style={{
              scale: '0.9', // nút nhỏ gọn hơn
            }}
          ></button>
        </div>

        {/* Body: sát lên hơn */}
        <div className="offcanvas-body px-2 pt-1" >
          <MachineTreeSidebarMobile
            machines={allLocations}
            machineInfo={machineInfo}
            navigate={navigate}
            width={width}
            selectedMachineId={machineInfo?.machine_id}
            duyTanLocations={duyTanLocations}
            otherLocations={otherLocations}
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

export default Machine;
