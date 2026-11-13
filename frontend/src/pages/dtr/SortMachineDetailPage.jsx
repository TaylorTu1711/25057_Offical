/**
 * Trang chi tiết máy DTR Sort — copy giao diện SCADA Plenma.
 * Biểu đồ loại chai theo giờ lấy từ cột counts (telemetry dtr).
 */
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../css/Machine.css';
import '../../css/DtrSortMachine.css';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';

import AppNavbar from '../../components/Navbar';
import DtrBottleCountsWithTotal from '../../components/dtr/DtrBottleCountsWithTotal';
import DtrBottleGroupPieChart from '../../components/dtr/DtrBottleGroupPieChart';
import DtrBottleTotalsPieChart from '../../components/dtr/DtrBottleTotalsPieChart';
import DtrBottleTypeMonthTable from '../../components/dtr/DtrBottleTypeMonthTable';
import DtrUtilizationPieChart from '../../components/dtr/DtrUtilizationPieChart';
import MachineTreeSidebar from '../../components/MachineTreeSidebar';
import MachineTreeSidebarMobile from '../../components/MachineTreeSidebarMobile';
import CumulativeRuntimeDisplay from '../../components/machine/CumulativeRuntimeDisplay';
import MachineInfoModal from '../../components/machine/MachineInfoModal';
import MachineStatusIconPanel from '../../components/machine/MachineStatusIconPanel';
import MachineTimeRangePanel from '../../components/machine/MachineTimeRangePanel';
import TimeRangeModal from '../../components/machine/TimeRangeModal';
import AutoFitMachineName from '../../components/machine/AutoFitMachineName';
import MidaChartExpand from '../../components/mida/MidaChartExpand';
import MidaStatusChart from '../../components/mida/MidaStatusChart';
import { BASE_URL } from '../../config/config';
import { authHeaders } from '../../utils/auth';
import { CHART_VIEW_MODES } from '../../utils/chartViewRange';
import { buildDtrPublicPath } from '../../utils/dtrSortMachine';
import useNow from '../../hooks/useNow';
import { isMachineConnected } from '../../utils/machineStatus';

/** DTR Sort: status 0 = dừng, 1 = chạy */
const isDtrRunning = (status) => Number(status) === 1;
const getDtrStatusLabel = (status) => {
  const s = Number(status);
  if (s === 1) return 'Chạy';
  if (s === 0) return 'Dừng';
  return '—';
};
/** Map sang convention Plenma (2=chạy, 1=dừng) cho tree/dot dùng chung. */
const dtrStatusForTree = (status) => {
  const s = Number(status);
  if (s === 1) return 2;
  if (s === 0) return 1;
  return status ?? null;
};

const DTR_STATUS_TICKS = { 0: 'Dừng', 1: 'Chạy' };
const DTR_TREE_ROOT_LABEL = 'Danh sách máy Sort DTR';
/** Ẩn khỏi tab biểu đồ thống kê số chai (bảng vẫn giữ). */
const BOTTLE_CHART_EXCLUDED_KEYS = new Set(['zz_cochai', 'zz_nap']);

const STATUS_RANGE_PRESETS = [
  { id: '1h', label: '1h', minutes: 60 },
  { id: '24h', label: '24h', minutes: 1440 },
];

const getRollingFromDate = (minutesAgo, to = new Date()) => {
  const from = new Date(to);
  from.setMinutes(from.getMinutes() - minutesAgo);
  return from;
};

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function resolveStatusRange(mode, customFrom, customTo, nowMs) {
  const now = new Date(nowMs);
  // Tuỳ chọn: đúng khoảng người dùng chọn (cùng ngày)
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
  // 1h / 24h: cửa sổ trượt tính từ thời điểm hiện tại
  const preset = STATUS_RANGE_PRESETS.find((p) => p.id === mode);
  const minutes = preset?.minutes ?? 60;
  return { from: getRollingFromDate(minutes, now), to: now, isLive: true };
}

export default function SortMachineDetailPage() {
  const { machine_id } = useParams();
  const navigate = useNavigate();

  const [width, setWidth] = useState(window.innerWidth);
  const [isLoading, setIsLoading] = useState(true);
  const [dtrMachines, setDtrMachines] = useState([]);
  const [dtrMachine, setDtrMachine] = useState(null);
  const [chartViewMode, setChartViewMode] = useState(CHART_VIEW_MODES.hour);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [modals, setModals] = useState({ machineInfo: false });
  const [countsSeries, setCountsSeries] = useState({ keys: [], buckets: [] });
  const [bottlesPanelTab, setBottlesPanelTab] = useState('chart'); // chart | table
  const [statusTimeline, setStatusTimeline] = useState({
    timestamps: [],
    statusValues: [],
    rangeFrom: null,
    rangeTo: null,
  });
  const [statusRangeMode, setStatusRangeMode] = useState('1h');
  const [statusFrom, setStatusFrom] = useState(null);
  const [statusTo, setStatusTo] = useState(null);
  const [showStatusRangeModal, setShowStatusRangeModal] = useState(false);
  const [tempStatusFrom, setTempStatusFrom] = useState(null);
  const [tempStatusTo, setTempStatusTo] = useState(null);
  const [liveStats, setLiveStats] = useState({
    utilization_pct: 0,
    period_utilization_pct: null,
    time_running: 0,
    total_counts: 0,
    status: null,
    last_telemetry_at: null,
    last_updated: null,
    available_years: [],
  });
  const now = useNow(15_000);

  const offcanvasRef = useRef(null);
  const nameCardRef = useRef(null);
  const chartsSplitRef = useRef(null);
  const piesColRef = useRef(null);
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

  const loadDtrMachines = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/portal/dtr/sort-machines`, {
        headers: authHeaders(),
      });
      const list = res.data?.machines || [];
      setDtrMachines(list);
      const current =
        list.find((m) => String(m.machine_id) === String(machine_id)) || null;
      setDtrMachine(current);
    } catch {
      setDtrMachines([]);
      setDtrMachine(null);
    } finally {
      setIsLoading(false);
    }
  }, [machine_id]);

  const loadCountsSeries = useCallback(async () => {
    if (!machine_id) return;
    try {
      const res = await axios.get(
        `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(machine_id)}/counts/hourly`,
        {
          headers: authHeaders(),
          params: {
            mode: chartViewMode,
            year: selectedYear,
            month: selectedMonth,
            day: selectedDay,
          },
        },
      );
      setCountsSeries({
        keys: res.data?.keys || [],
        buckets: res.data?.buckets || res.data?.hours || [],
      });
    } catch {
      setCountsSeries({ keys: [], buckets: [] });
    }
  }, [machine_id, chartViewMode, selectedYear, selectedMonth, selectedDay]);

  const loadLiveStats = useCallback(async () => {
    if (!machine_id) return;
    try {
      const res = await axios.get(
        `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(machine_id)}/stats`,
        {
          headers: authHeaders(),
          params: {
            mode: chartViewMode,
            year: selectedYear,
            month: selectedMonth,
            day: selectedDay,
          },
        },
      );
      const years = Array.isArray(res.data?.available_years)
        ? res.data.available_years.map(Number).filter((y) => Number.isFinite(y))
        : [];
      const periodPct = res.data?.period_utilization_pct;
      setLiveStats({
        utilization_pct: Number(res.data?.utilization_pct) || 0,
        period_utilization_pct:
          periodPct != null && Number.isFinite(Number(periodPct))
            ? Number(periodPct)
            : null,
        time_running: Number(res.data?.time_running) || 0,
        total_counts: Number(res.data?.total_counts) || 0,
        status: res.data?.status ?? null,
        last_telemetry_at: res.data?.last_telemetry_at ?? null,
        last_updated: res.data?.last_updated ?? null,
        available_years: years,
      });
      if (years.length > 0) {
        setSelectedYear((prev) => (years.includes(prev) ? prev : years[0]));
      }
    } catch {
      setLiveStats({
        utilization_pct: 0,
        period_utilization_pct: null,
        time_running: 0,
        total_counts: 0,
        status: null,
        last_telemetry_at: null,
        last_updated: null,
        available_years: [],
      });
    }
  }, [machine_id, chartViewMode, selectedYear, selectedMonth, selectedDay]);

  const loadStatusTimeline = useCallback(async () => {
    if (!machine_id) return;
    const { from, to } = resolveStatusRange(
      statusRangeMode,
      statusFrom,
      statusTo,
      Date.now(),
    );
    try {
      const res = await axios.get(
        `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(machine_id)}/status`,
        {
          headers: authHeaders(),
          params: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
        },
      );
      setStatusTimeline({
        timestamps: Array.isArray(res.data?.timestamps) ? res.data.timestamps : [],
        statusValues: Array.isArray(res.data?.statusValues) ? res.data.statusValues : [],
        rangeFrom: from.getTime(),
        rangeTo: to.getTime(),
      });
    } catch {
      setStatusTimeline({
        timestamps: [],
        statusValues: [],
        rangeFrom: from.getTime(),
        rangeTo: to.getTime(),
      });
    }
  }, [machine_id, statusRangeMode, statusFrom, statusTo]);

  useEffect(() => {
    loadDtrMachines();
  }, [loadDtrMachines]);

  useEffect(() => {
    loadCountsSeries();
    loadLiveStats();
    loadStatusTimeline();
    const timer = setInterval(() => {
      loadCountsSeries();
      loadLiveStats();
      // custom range: không poll lại cửa sổ cố định
      if (statusRangeMode !== 'custom') {
        loadStatusTimeline();
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadCountsSeries, loadLiveStats, loadStatusTimeline, statusRangeMode]);

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
    setShowStatusRangeModal(false);
    return true;
  };

  const statusRangeControls = (
    <div className="mida-status-range" role="group" aria-label="Khoảng thời gian trạng thái">
      {STATUS_RANGE_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`mida-status-range__btn${statusRangeMode === p.id ? ' is-active' : ''}`}
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
  );

  /** Pie hiệu suất theo khung giờ/ngày/tháng/quý/năm đã chọn */
  const periodUtilizationPct = useMemo(() => {
    const raw = liveStats.period_utilization_pct;
    const v = raw != null ? Number(raw) : Number(liveStats.utilization_pct) || 0;
    if (!Number.isFinite(v) || v < 0) return 0;
    return Math.min(100, v);
  }, [liveStats.period_utilization_pct, liveStats.utilization_pct]);

  // DTR: status 0 = dừng, 1 = chạy
  const statusLastSeen =
    liveStats.last_telemetry_at || liveStats.last_updated || dtrMachine?.last_updated || null;
  const machineIsConnected = isMachineConnected(statusLastSeen, now);
  const machineIsRunningRaw = isDtrRunning(liveStats.status);
  const machineIsRunningForIcon = machineIsConnected && machineIsRunningRaw;
  const statusIconTitle = machineIsConnected
    ? `Trạng thái: ${getDtrStatusLabel(liveStats.status)} (status=${liveStats.status ?? '—'})`
    : 'Mất kết nối / chưa có dữ liệu realtime';

  const machineInfo = useMemo(
    () => ({
      machine_id,
      machine_name: dtrMachine?.machine_name || dtrMachine?.name || machine_id || 'Máy sort',
      location: dtrMachine?.location || DTR_TREE_ROOT_LABEL,
      image_url: dtrMachine?.image_url || null,
      status: liveStats.status ?? dtrMachine?.status ?? null,
      last_updated: statusLastSeen,
      information: dtrMachine?.note || '',
      output_name: dtrMachine?.output_name || 'Sản lượng',
      output_unit: dtrMachine?.output_unit || 'Cái',
      input_name: dtrMachine?.input_name || 'Nguyên liệu',
      input_unit: dtrMachine?.input_unit || 'Cái',
      tailscale_ip: dtrMachine?.tailscale_ip,
      port: dtrMachine?.port,
      api_port: dtrMachine?.api_port,
      handover_date: dtrMachine?.handover_date || null,
    }),
    [dtrMachine, machine_id, liveStats.status, statusLastSeen],
  );

  const handoverDateLabel = useMemo(() => {
    const raw = machineInfo.handover_date;
    if (!raw) return '';
    const s = String(raw).trim();
    const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
    if (iso) {
      const [y, m, d] = iso.split('-');
      return `Ngày bàn giao: ${d}/${m}/${y}`;
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return `Ngày bàn giao: ${d.toLocaleDateString('vi-VN')}`;
  }, [machineInfo.handover_date]);

  /* Cột pie thẳng hàng dọc với thẻ tên máy (desktop). Mobile/tablet xếp dọc → bỏ sync. */
  useLayoutEffect(() => {
    const nameEl = nameCardRef.current;
    const splitEl = chartsSplitRef.current;
    const piesEl = piesColRef.current;
    if (!nameEl || !splitEl || !piesEl) return undefined;

    const syncPiesAlign = () => {
      /* Xếp dọc khi < xl — bỏ sync ngang theo thẻ tên máy */
      const stacked = window.matchMedia('(max-width: 1199.98px)').matches;
      if (stacked) {
        piesEl.style.removeProperty('--dtr-pies-w');
        piesEl.style.removeProperty('--dtr-pies-ml');
        return;
      }
      const nameRect = nameEl.getBoundingClientRect();
      const splitRect = splitEl.getBoundingClientRect();
      const w = Math.max(0, Math.round(nameRect.width));
      const left = Math.max(0, Math.round(nameRect.left - splitRect.left));
      piesEl.style.setProperty('--dtr-pies-w', `${w}px`);
      piesEl.style.setProperty('--dtr-pies-ml', `${left}px`);
    };

    syncPiesAlign();
    const ro = new ResizeObserver(syncPiesAlign);
    ro.observe(nameEl);
    ro.observe(splitEl);
    window.addEventListener('resize', syncPiesAlign);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncPiesAlign);
    };
  }, [width, machineInfo.machine_name, isLoading]);

  const treeMachines = useMemo(
    () =>
      dtrMachines.map((m) => {
        const isCurrent = String(m.machine_id) === String(machine_id);
        const rawStatus = isCurrent ? (liveStats.status ?? m.status ?? null) : (m.status ?? null);
        return {
          machine_id: m.machine_id,
          machine_name: m.machine_name || m.name || m.machine_id,
          status: dtrStatusForTree(rawStatus),
          last_updated: isCurrent
            ? (statusLastSeen || m.last_updated || null)
            : (m.last_updated ?? null),
        };
      }),
    [dtrMachines, machine_id, liveStats.status, statusLastSeen],
  );

  const availableYears = useMemo(() => {
    const years = liveStats.available_years || [];
    if (years.length > 0) return years;
    // Chưa có telemetry: vẫn cho chọn năm hiện tại
    return [selectedYear || new Date().getFullYear()];
  }, [liveStats.available_years, selectedYear]);

  const getMachinePath = useCallback((id) => `/dtr/sortmachine/${id}`, []);

  const countsChartLabels = useMemo(
    () => (countsSeries.buckets || []).map((h) => h.label),
    [countsSeries.buckets],
  );
  const countsChartKeys = useMemo(
    () => countsSeries.keys || [],
    [countsSeries.keys],
  );
  const bottleChartKeys = useMemo(
    () =>
      (countsChartKeys || []).filter(
        (k) => !BOTTLE_CHART_EXCLUDED_KEYS.has(String(k).toLowerCase()),
      ),
    [countsChartKeys],
  );
  const countsChartSeries = useMemo(() => {
    const out = {};
    for (const key of countsChartKeys) {
      out[key] = (countsSeries.buckets || []).map((h) => Number(h.counts?.[key]) || 0);
    }
    return out;
  }, [countsChartKeys, countsSeries.buckets]);

  return (
    <div className="dtr-monitor-page">
      <AppNavbar
        title="GIÁM SÁT MÁY SORT DTR"
        extraActions={
          machine_id ? (
            <div
              className="dtr-online-toggle"
              role="group"
              aria-label="Chế độ Online / Offline"
            >
              <button
                type="button"
                className="dtr-online-toggle__btn is-active"
                aria-pressed="true"
                title="Chế độ Offline (giám sát portal)"
                onClick={() => {
                  navigate(`/dtr/sortmachine/${encodeURIComponent(machine_id)}`);
                }}
              >
                Offline
              </button>
              <button
                type="button"
                className="dtr-online-toggle__btn"
                aria-pressed="false"
                title="Chế độ Online (máy Sort qua Tailscale)"
                onClick={() => {
                  window.location.assign(buildDtrPublicPath(machine_id));
                }}
              >
                Online
              </button>
            </div>
          ) : null
        }
      />

      {showMachineListToggle && !isOpen ? (
        <button
          type="button"
          className="dtr-sidebar-pull"
          onClick={toggleMachineList}
          aria-label="Mở danh sách máy"
          aria-controls="offcanvasDtrMachinesList"
          title="Danh sách máy"
        >
          <span className="dtr-sidebar-pull__grip" aria-hidden="true" />
          <i className="bi bi-chevron-right dtr-sidebar-pull__icon" aria-hidden="true" />
        </button>
      ) : null}

      <div className="d-flex dtr-monitor-page__body" style={{ width: '100%' }}>
        <MachineTreeSidebar
          machines={treeMachines}
          navigate={navigate}
          width={width}
          selectedMachineId={machine_id}
          rootLabel={DTR_TREE_ROOT_LABEL}
          getMachinePath={getMachinePath}
        />

        <div className="dtr-monitor-page__main">
          <div className="row g-1 machine-top-panel">
            <div className="col-12 col-xl-6 machine-top-panel__col-left">
              <div className="row g-1 machine-top-panel__main-row">
                <div className="col-12 col-lg-8 machine-top-panel__stats-col">
                  <div className="row g-1 machine-top-panel__stats-grid-row machine-top-panel__name-row">
                    <div className="col-8">
                      <div
                        ref={nameCardRef}
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
                          text={machineInfo.machine_name}
                          maxFontSize={24}
                          minFontSize={11}
                          style={{ width: '100%', flex: '1 1 auto', minHeight: 0 }}
                        />
                        {handoverDateLabel ? (
                          <div className="machine-top-panel__handover-date" title={handoverDateLabel}>
                            {handoverDateLabel}
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
                          isConnected={machineIsConnected}
                          title={statusIconTitle}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row g-1 machine-top-panel__stats-grid-row machine-top-panel__stat-row">
                    <div className="col-8 machine-top-panel__stat-pair">
                      <div className="row g-1 machine-top-panel__stat-pair-inner">
                        <div className="col-6">
                          <div
                            className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box machine-top-panel__stat-box--util-pie"
                            title={`Hiệu suất: ${Number(periodUtilizationPct || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`}
                          >
                            <DtrUtilizationPieChart
                              title="HIỆU SUẤT SỬ DỤNG"
                              utilizationPct={periodUtilizationPct}
                              compact
                            />
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded text-center shadow d-flex flex-column bg-white machine-top-panel__stat-box">
                            <p className="fw-semibold mb-0 text-brand">SẢN LƯỢNG LŨY KẾ</p>
                            <div
                              className="flex-grow-1 d-flex align-items-center justify-content-center"
                              title="Tổng tất cả loại chai trong counts"
                            >
                              <h5 className="m-0 text-dark machine-top-panel__stat-value">
                                {Number(liveStats.total_counts || 0).toLocaleString('vi-VN')}
                                <span className="machine-top-panel__stat-unit"> chai</span>
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
                          <CumulativeRuntimeDisplay
                            serverSeconds={liveStats.time_running}
                            isRunning={machineIsRunningForIcon}
                            machineId={machine_id}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4 machine-top-panel__image-col">
                  <div className="bg-white border rounded shadow w-100 machine-top-panel__image-wrap overflow-hidden">
                    {machineInfo.image_url ? (
                      <img
                        src={`${BASE_URL}${machineInfo.image_url}`}
                        alt={machineInfo.machine_name || machine_id}
                        className="w-100 h-100"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                        <span style={{ fontSize: '0.85rem' }}>Chưa có ảnh máy</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-6 machine-top-panel__col-alarms">
              <div className="row g-1 h-100 machine-top-panel__alarms-row">
                <div className="col-12 col-sm-9 order-2 order-sm-1 d-flex min-h-0">
                  <div className="card shadow rounded machine-top-panel__alarms machine-top-panel__alarms--list dtr-status-card w-100 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between flex-shrink-0 card-header-row dtr-status-card__head">
                      <h6 className="text-brand fw-bold mb-0 dtr-status-card__title">BIỂU ĐỒ TRẠNG THÁI</h6>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        {statusRangeControls}
                        <MidaChartExpand
                          title="BIỂU ĐỒ TRẠNG THÁI"
                          tone="plenma"
                          extraHead={statusRangeControls}
                        >
                          <MidaStatusChart
                            key={`status-fs-${statusRangeMode}-${statusFrom?.getTime?.() ?? 0}-${statusTo?.getTime?.() ?? 0}`}
                            timestamps={statusTimeline.timestamps}
                            statusValues={statusTimeline.statusValues}
                            statusTicks={DTR_STATUS_TICKS}
                            rangeFrom={statusTimeline.rangeFrom}
                            rangeTo={statusTimeline.rangeTo}
                            enableAnimation
                          />
                        </MidaChartExpand>
                      </div>
                    </div>
                    <div className="flex-grow-1 min-h-0 dtr-status-card__plot" style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0 }}>
                        <MidaStatusChart
                          key={`status-${statusRangeMode}-${statusFrom?.getTime?.() ?? 0}-${statusTo?.getTime?.() ?? 0}`}
                          timestamps={statusTimeline.timestamps}
                          statusValues={statusTimeline.statusValues}
                          statusTicks={DTR_STATUS_TICKS}
                          rangeFrom={statusTimeline.rangeFrom}
                          rangeTo={statusTimeline.rangeTo}
                          enableAnimation
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-3 order-1 order-sm-2 d-flex min-h-0">
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
                    availableYears={availableYears}
                    pickerYear={selectedYear}
                    modes={[
                      CHART_VIEW_MODES.hour,
                      CHART_VIEW_MODES.day,
                      CHART_VIEW_MODES.month,
                      CHART_VIEW_MODES.quarter,
                      CHART_VIEW_MODES.year,
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="dtr-monitor-page__charts">
            {/*
              pies + thẻ BIỂU ĐỒ THỐNG KÊ SỐ CHAI là sibling trực tiếp
              (không bọc charts-split) → mobile xếp cột không bị cắt/ẩn.
            */}
            <div
              className="dtr-monitor-page__charts-row dtr-monitor-page__charts-row--bottles"
              ref={chartsSplitRef}
            >
              <div className="dtr-monitor-page__pies" ref={piesColRef}>
                <DtrBottleTotalsPieChart
                  title="TỈ LỆ LOẠI CHAI"
                  keys={countsChartKeys}
                  series={countsChartSeries}
                />
                <DtrBottleGroupPieChart
                  title="TỈ LỆ CHAI KHÔNG NHÃN"
                  keys={countsChartKeys}
                  series={countsChartSeries}
                />
              </div>
              <div className="dtr-monitor-page__bottles-chart">
                <div className="card p-2 shadow d-flex flex-column machine-chart-card w-100">
                  <div className="dtr-bottles-panel-tabs" role="tablist" aria-label="Thống kê số chai">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bottlesPanelTab === 'chart'}
                      className={`dtr-bottles-panel-tabs__btn${bottlesPanelTab === 'chart' ? ' is-active' : ''}`}
                      onClick={() => setBottlesPanelTab('chart')}
                    >
                      Biểu đồ
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bottlesPanelTab === 'table'}
                      className={`dtr-bottles-panel-tabs__btn${bottlesPanelTab === 'table' ? ' is-active' : ''}`}
                      onClick={() => setBottlesPanelTab('table')}
                    >
                      Bảng loại chai
                    </button>
                  </div>
                  <div className="dtr-bottles-panel-tabs__body">
                    {bottlesPanelTab === 'chart' ? (
                      <DtrBottleCountsWithTotal
                        labels={countsChartLabels}
                        keys={bottleChartKeys}
                        series={countsChartSeries}
                        bottleGlossary={dtrMachine?.bottle_glossary}
                      />
                    ) : (
                      <DtrBottleTypeMonthTable
                        mode={chartViewMode}
                        year={selectedYear}
                        month={selectedMonth}
                        day={selectedDay}
                        keys={countsSeries.keys}
                        buckets={countsSeries.buckets}
                      />
                    )}
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
        isConnected={(lastUpdated) => isMachineConnected(lastUpdated, now)}
        onClose={() => setModals((prev) => ({ ...prev, machineInfo: false }))}
        onBoot={null}
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

      {showMachineListToggle ? (
        <div
          className="offcanvas offcanvas-start dtr-machines-offcanvas"
          tabIndex="-1"
          id="offcanvasDtrMachinesList"
          ref={offcanvasRef}
          style={{ width: '265px' }}
          aria-labelledby="offcanvasDtrMachinesListLabel"
          data-bs-backdrop="true"
          data-bs-keyboard="true"
        >
          <div className="offcanvas-header dtr-machines-offcanvas__header">
            <h5 className="machine-tree-sidebar__title" id="offcanvasDtrMachinesListLabel">
              {DTR_TREE_ROOT_LABEL}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="offcanvas"
              aria-label="Đóng"
            />
          </div>
          <div className="offcanvas-body dtr-machines-offcanvas__body">
            <MachineTreeSidebarMobile
              machines={treeMachines}
              navigate={navigate}
              selectedMachineId={machine_id}
              rootLabel={DTR_TREE_ROOT_LABEL}
              getMachinePath={getMachinePath}
              onNavigate={() => offcanvasInstance?.hide()}
            />
          </div>
        </div>
      ) : null}

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
