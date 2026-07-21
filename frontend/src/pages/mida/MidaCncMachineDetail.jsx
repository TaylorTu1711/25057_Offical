import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';

import LineChart_TimeOn from '../../components/BarChart_Thoigian';
import BarChartStatus from '../../components/BarChart_Status';
import CumulativeRuntimeDisplay from '../../components/machine/CumulativeRuntimeDisplay';
import MachineInfoModal from '../../components/machine/MachineInfoModal';
import MachineStatusIconPanel from '../../components/machine/MachineStatusIconPanel';
import MachineTimeRangePanel from '../../components/machine/MachineTimeRangePanel';
import AutoFitMachineName from '../../components/machine/AutoFitMachineName';
import ResizableTableHeader from '../../components/home/ResizableTableHeader';

import MidaNavbar from '../../components/mida/MidaNavbar';
import MidaMachineSidebar from '../../components/mida/MidaMachineSidebar';
import MidaMachineSidebarMobile from '../../components/mida/MidaMachineSidebarMobile';
import MidaGaugeChart from '../../components/mida/MidaGaugeChart';
import MidaElectricalCards from '../../components/mida/MidaElectricalCards';
import MidaPowerCurrentChart from '../../components/mida/MidaPowerCurrentChart';

import useMidaMachineData from '../../hooks/useMidaMachineData';
import useNow from '../../hooks/useNow';
import useStableMachineRunning from '../../hooks/useStableMachineRunning';
import useResizableTableColumns from '../../hooks/useResizableTableColumns';

import { BASE_URL } from '../../config/config';
import { authHeaders } from '../../utils/auth';
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
  toErrorChartTickMode,
  getChartCategoryPrefix,
  getYearKeysFromData,
} from '../../utils/chartViewRange';
import { parseHandoverDate } from '../../utils/parseStandardProductivity';
import {
  buildStatusTimelineChart,
  buildPowerCurrentTimelineChart,
} from '../../utils/machineStatusTimeline';

import '../../css/Machine.css';
import '../../css/MidaCnc.css';

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

export default function MidaCncMachineDetail() {
  const { machine_id } = useParams();
  const navigate = useNavigate();
  const now = useNow(POLL_INTERVALS.connectionTick);

  const machineData = useMidaMachineData(machine_id);
  const {
    machineInfo,
    rawMachineData,
    rawData,
    statusMachine,
    errorsMachine,
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
  } = machineData;

  const [deleting, setDeleting] = useState(false);
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


  const {
    widthsPercent: alarmColWidths,
    resizingKey: alarmResizingKey,
    onResizeStart: onAlarmColResizeStart,
  } = useResizableTableColumns(
    'mida_machine_alarm_table_column_percent',
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
  const [timeRunValues, setTimeRunValues] = useState([]);
  const [energyKwhValues, setEnergyKwhValues] = useState([]);
  const [powerChartValues, setPowerChartValues] = useState([]);
  const [currentChartValues, setCurrentChartValues] = useState([]);
  const [elecChartLabels, setElecChartLabels] = useState([]);
  const [labelsChart3, setLabelsChart3] = useState([]);
  const [statusDataValuesChart3, setStatusDataValuesChart3] = useState([]);
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
  }, [rawData, chartViewMode, chartSelection]);

  const isConnected = (lastUpdated) => isMachineConnected(lastUpdated, now);

  useEffect(() => {
    const effectiveTo = new Date(now);
    const effectiveFrom = getRollingFromDate(1440, effectiveTo);
    const liveStatus = statusMachine?.status ?? machineInfo?.status ?? null;
    const { labels, mappedData } = buildStatusTimelineChart(
      rawMachineData,
      effectiveFrom,
      effectiveTo,
      5,
      liveStatus,
    );

    setLabelsChart3((prev) => (chartSeriesEqual(prev, labels) ? prev : labels));
    setStatusDataValuesChart3((prev) => (chartSeriesEqual(prev, mappedData) ? prev : mappedData));

    // Biểu đồ công suất/dòng điện: cửa sổ 60 phút, độ phân giải 1 giây
    const elecTo = new Date(now);
    const elecFrom = getRollingFromDate(60, elecTo);
    const electrical = buildPowerCurrentTimelineChart(
      rawMachineData,
      elecFrom,
      elecTo,
      1,
      powerKw,
      currentAvg,
    );
    setElecChartLabels((prev) =>
      chartSeriesEqual(prev, electrical.labels) ? prev : electrical.labels,
    );
    setPowerChartValues((prev) =>
      chartSeriesEqual(prev, electrical.power) ? prev : electrical.power,
    );
    setCurrentChartValues((prev) =>
      chartSeriesEqual(prev, electrical.current) ? prev : electrical.current,
    );
  }, [
    rawMachineData,
    now,
    statusMachine?.status,
    machineInfo?.status,
    powerKw,
    currentAvg,
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
          {/* Phần thông tin máy và cảnh báo */}
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
                        <p className="fw-semibold mb-0 text-brand">THỜI GIAN CHẠY LŨY KẾ</p>
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

            {/* Ảnh máy + danh sách cảnh báo — cùng độ rộng cột biểu đồ trạng thái */}
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

              <div className="machine-top-panel__alarms-wrap d-flex min-h-0">
                <div className="card shadow rounded machine-top-panel__alarms machine-top-panel__alarms--list w-100">
                  <div className="d-flex align-items-center mb-2 flex-shrink-0 card-header-row">
                    <h6 className="text-danger fw-bold mb-0">DANH SÁCH CẢNH BÁO</h6>
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
                              <td title={String(err.alarm_id)}>{err.alarm_id}</td>
                              <td className="resizable-table__cell--wrap" title={err.alarm_name}>
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
                  value={utilizationMachine}
                  label="HIỆU SUẤT VẬN HÀNH"
                  variant="utilization"
                />
                <MidaGaugeChart
                  value={performanceMachine}
                  label="HIỆU SUẤT KHAI THÁC"
                  variant="performance"
                />
              </div>
            </div>

            <div className="mida-charts-cell mida-charts-cell--status">
              <div className="card p-2 shadow d-flex flex-column machine-chart-card machine-chart-card--status">
                <div className="chart-title-brand machine-chart-head">
                  <div>BIỂU ĐỒ TRẠNG THÁI</div>
                </div>
                <div className="machine-chart-plot">
                  <div className="machine-chart-plot-inner">
                    <BarChartStatus labels={labelsChart3} line1={statusDataValuesChart3} />
                  </div>
                </div>
                <div
                  className="d-flex justify-content-between flex-wrap machine-chart-foot machine-chart-foot--balance"
                  aria-hidden="true"
                >
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
                <div className="chart-title-brand machine-chart-head">
                  <div>CÔNG SUẤT VÀ DÒNG ĐIỆN</div>
                </div>
                <div className="machine-chart-plot">
                  <div className="machine-chart-plot-inner">
                    <MidaPowerCurrentChart
                      labels={elecChartLabels}
                      powerValues={powerChartValues}
                      currentValues={currentChartValues}
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
        onBoot={handleBootData}
        onDelete={handleDelete}
        deleting={deleting}
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
