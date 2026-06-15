
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import BarLineChart_Sanluong from '../components/BarChart';
import LineChart_TimeOn from '../components/BarChart_Thoigian';
import BarChartStatus from '../components/BarChart_Status';
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
import useLiveCumulativeRuntime from '../hooks/useLiveCumulativeRuntime';
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
import MachineStatusAnimated from '../components/machine/MachineStatusAnimated';
import AnalysisErrorModal from '../components/machine/AnalysisErrorModal';
import MachineTimeRangePanel from '../components/machine/MachineTimeRangePanel';
import AutoFitMachineName from '../components/machine/AutoFitMachineName';
import useResizableTableColumns from '../hooks/useResizableTableColumns';
import ResizableTableHeader from '../components/home/ResizableTableHeader';
import {
  CHART_VIEW_MODES,
  RANGE_DISPLAY_MODES,
  getDefaultRangeDates,
  buildProductivitySeries,
  buildTimeSeries,
  buildErrorSeries,
  toErrorChartTickMode,
  getChartCategoryPrefix,
  getYearKeysFromData,
} from '../utils/chartViewRange';
import { parseStandardProductivity, parseHandoverDate } from '../utils/parseStandardProductivity';
import { hasInputProductInfo, hasOutputProductInfo } from '../utils/machineProductInfo';

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

const ERROR_DETAIL_TOP_N = 10;

/** Khóa ngày theo giờ local — tránh lệch UTC khi ghép dữ liệu biểu đồ */
const toLocalDateKey = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRollingFromDate = (minutesAgo) => {
  const d = new Date();
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
    errorsMachine,
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
  const [labelsChart3, setLabelsChart3] = useState([]);
  const [statusDataValuesChart3, setStatusDataValuesChart3] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
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
    machineInfo?.status ?? statusMachine?.status ?? null;
  const machineIsConnected = isMachineConnected(
    machineInfo?.last_updated ?? statusMachine?.last_updated,
    now
  );
  const machineIsRunning = machineIsConnected && isMachineRunning(currentMachineStatus);
  const machineIsRunningForIcon = useStableMachineRunning(machineIsRunning);
  const liveRuntimeSeconds = useLiveCumulativeRuntime(
    totalTimeOnSeconds,
    machineIsRunning,
    machine_id,
  );
  const statusIconAlt = !machineIsConnected
    ? 'Mất kết nối PLC'
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
      availableYears: availableChartYears,
      dateFrom: rangeFrom,
      dateTo: rangeTo,
      rangeDisplay,
    }),
    [selectedYear, selectedMonth, availableChartYears, rangeFrom, rangeTo, rangeDisplay],
  );

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

  const errorDetailStats = useMemo(() => buildErrorStats(allErrorsMachine), [allErrorsMachine]);

  const hasErrorDetailData = errorDetailStats.dataValues.some((v) => Number(v) > 0);
  const showErrorByType = errorChartView === ERROR_CHART_VIEWS.byType;

  const handleRangeApply = useCallback(({ from, to }) => {
    setRangeFrom(from);
    setRangeTo(to);
  }, []);

  useEffect(() => {
    if (!selectedDay || !rawData.length) return;

    // Lọc dữ liệu trong ngày được chọn
    const dataInDay = rawData.filter(
      (d) => new Date(d.timestamp).toISOString().slice(0, 10) === selectedDay
    );

    // Tìm dữ liệu mới nhất trong ngày đó (timestamp lớn nhất)
    const latestData = dataInDay.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    , dataInDay[0]); // giá trị khởi đầu
    setSelectedMachineData(latestData);
  }, [selectedDay, rawData]);

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

  function generateTimestampsInRange(start, end, intervalMinutes = 5) {
  const timestamps = [];
  const current = new Date(start);
  while (current <= end) {
    timestamps.push(new Date(current));
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }
  return timestamps;
}


  useEffect(() => {
    const effectiveTo = new Date(now);
    const effectiveFrom = getRollingFromDate(1440);

    const rangeFiltered = rawMachineData.filter((d) => {
      const ts = new Date(d.timestamp);
      return ts >= effectiveFrom && ts <= effectiveTo;
    });

    rangeFiltered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const rangeTimestamps = generateTimestampsInRange(effectiveFrom, effectiveTo, 5);

    const mappedData = rangeTimestamps.map((t) => {
      const match = rangeFiltered.find((d) => {
        const dataTime = new Date(d.timestamp);
        return Math.abs(dataTime - t) < 1000 * 60 * 2.5;
      });
      return match ? match.status : null;
    });

    const labels = rangeTimestamps.map((t) =>
      t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    );

    setLabelsChart3((prev) => (chartSeriesEqual(prev, labels) ? prev : labels));
    setStatusDataValuesChart3((prev) => (chartSeriesEqual(prev, mappedData) ? prev : mappedData));
  }, [rawMachineData, now]);

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
                      <MachineStatusAnimated
                        key={machine_id}
                        isRunning={machineIsRunningForIcon}
                        isConnected={machineIsConnected}
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
                          <CumulativeRuntimeDisplay totalSeconds={liveRuntimeSeconds} />
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
                        {errorsMachine?.length > 0 ? (
                          errorsMachine.map((err) => (
                            <tr key={err.id}>
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
                  availableYears={availableChartYears}
                  pickerYear={selectedYear}
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
              <div className="chart-title-brand machine-chart-head">
                <div>BIỂU ĐỒ SẢN LƯỢNG</div>
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
              <div className="chart-title-brand machine-chart-head">
                <div>BIỂU ĐỒ THỜI GIAN & NĂNG SUẤT</div>
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
              <div className="chart-title-brand machine-chart-head machine-chart-head--detail">
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
              <div className="chart-title-brand machine-chart-head">
                <div>BIỂU ĐỒ TRẠNG THÁI</div>
              </div>

              <div className="machine-chart-plot">
                <div className="machine-chart-plot-inner">
                  <BarChartStatus labels={labelsChart3} line1={statusDataValuesChart3} />
                </div>
              </div>

              <div className="d-flex justify-content-between flex-wrap machine-chart-foot machine-chart-foot--balance" aria-hidden="true">
                <div className="text-brand" style={{ fontWeight: 'bold' }}>
                  &nbsp;
                </div>
                <div className="d-flex gap-1 flex-wrap">
                  <div>min: 0</div>
                  <div>max: 0</div>
                  <div>avg: 0</div>
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
