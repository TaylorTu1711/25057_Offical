import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Move, Pause, Play, Plus, WifiOff } from 'lucide-react';
import MidaStatusPill from './MidaStatusPill';
import MidaTotalStatBar from './MidaTotalStatBar';
import axios from 'axios';
import factoryLayoutImg from '../../assets/mida/layout nha may.png';
import { BASE_URL } from '../../config/config';
import { MIDA_FACTORY_SLOTS } from '../../config/midaFactoryLayout';
import { authHeaders } from '../../utils/auth';
import { getMachineStatusLabel, isMachineConnected, isMachineRunning } from '../../utils/machineStatus';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function TagCallout({ name }) {
  return (
    <div className="mida-factory__callout">
      <span className="mida-factory__tag">{String(name).toUpperCase()}</span>
    </div>
  );
}

function markerStatusClass(machine, now) {
  const connected = isMachineConnected(machine.last_updated, now);
  if (!connected) return 'is-offline';
  if (isMachineRunning(machine.status)) return 'is-run';
  return 'is-stop';
}

function resolvePosition(machine, index) {
  if (machine.layout_x != null && machine.layout_y != null) {
    return { left: Number(machine.layout_x), top: Number(machine.layout_y) };
  }
  return MIDA_FACTORY_SLOTS[index] ?? { left: 50, top: 50 };
}

function buildInitialPositions(machines) {
  const sorted = [...machines].sort((a, b) =>
    String(a.machine_id).localeCompare(String(b.machine_id), 'vi'),
  );
  const positions = {};
  sorted.forEach((machine, index) => {
    positions[machine.machine_id] = resolvePosition(machine, index);
  });
  return positions;
}

export default function MidaFactoryLayout({
  machines,
  now,
  onLayoutSaved,
  statLabel,
  stats,
  onCreateClick,
  machineTabs,
  activeTab,
  onTabChange,
}) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const zoomWrapRef = useRef(null);
  const tabsOverlayRef = useRef(null);
  const statsOverlayRef = useRef(null);
  const statsFullWidthRef = useRef(0);
  const mobileZoomRef = useRef({ scale: 0, width: 0, height: 0 });
  const draggingIdRef = useRef(null);
  const positionsRef = useRef({});

  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState('');
  const [positions, setPositions] = useState(() => buildInitialPositions(machines));
  const [savingId, setSavingId] = useState('');
  const [saveError, setSaveError] = useState('');
  const [statsCompact, setStatsCompact] = useState(false);

  const sorted = useMemo(
    () => [...machines].sort((a, b) => String(a.machine_id).localeCompare(String(b.machine_id), 'vi')),
    [machines],
  );

  useEffect(() => {
    setPositions(buildInitialPositions(machines));
  }, [machines]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const wrapEl = zoomWrapRef.current;
    const canvasEl = containerRef.current;
    if (!scrollEl || !wrapEl || !canvasEl) return undefined;

    const mobileMq = window.matchMedia('(max-width: 991.98px)');
    const hasCenteredRef = { current: false };
    const touchActiveRef = { current: false };
    let rafId = 0;

    const resetMobileZoom = () => {
      scrollEl.classList.remove('is-mobile-zoom');
      wrapEl.style.width = '';
      wrapEl.style.height = '';
      canvasEl.style.transform = '';
      canvasEl.style.transformOrigin = '';
      mobileZoomRef.current = { scale: 0, width: 0, height: 0 };
      hasCenteredRef.current = false;
    };

    const updateMobileCoverScale = () => {
      if (!mobileMq.matches) {
        resetMobileZoom();
        return;
      }

      // Đang kéo bằng tay — không đụng scroll / scale (tránh bị kéo về giữa)
      if (touchActiveRef.current) return;

      const { width: viewW, height: viewH } = scrollEl.getBoundingClientRect();
      const canvasW = canvasEl.offsetWidth;
      const canvasH = canvasEl.offsetHeight;
      if (!viewW || !viewH || !canvasW || !canvasH) return;

      const scale = Math.max(viewW / canvasW, viewH / canvasH);
      const scaledW = canvasW * scale;
      const scaledH = canvasH * scale;
      const prev = mobileZoomRef.current;
      const layoutChanged =
        Math.abs(prev.scale - scale) > 0.002
        || Math.abs(prev.width - scaledW) > 2
        || Math.abs(prev.height - scaledH) > 2;

      if (!layoutChanged && prev.scale > 0) return;

      const prevScrollLeft = scrollEl.scrollLeft;
      const prevScrollTop = scrollEl.scrollTop;

      wrapEl.style.width = `${scaledW}px`;
      wrapEl.style.height = `${scaledH}px`;
      canvasEl.style.transform = `scale(${scale})`;
      canvasEl.style.transformOrigin = 'top left';
      scrollEl.classList.add('is-mobile-zoom');

      const maxL = Math.max(0, scaledW - viewW);
      const maxT = Math.max(0, scaledH - viewH);

      if (!hasCenteredRef.current) {
        scrollEl.scrollLeft = maxL / 2;
        scrollEl.scrollTop = maxT / 2;
        hasCenteredRef.current = true;
      } else {
        // Giữ nguyên pixel đang xem, chỉ clamp trong biên mới
        scrollEl.scrollLeft = clamp(prevScrollLeft, 0, maxL);
        scrollEl.scrollTop = clamp(prevScrollTop, 0, maxT);
      }

      mobileZoomRef.current = { scale, width: scaledW, height: scaledH };
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateMobileCoverScale);
    };

    const onTouchStart = () => {
      touchActiveRef.current = true;
    };
    const onTouchEnd = () => {
      touchActiveRef.current = false;
      // Sau khi thả tay mới cập nhật scale nếu viewport đổi (thanh địa chỉ iOS)
      scheduleUpdate();
    };

    const img = canvasEl.querySelector('img');
    if (img && !img.complete) {
      img.addEventListener('load', scheduleUpdate);
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(scrollEl);
    resizeObserver.observe(canvasEl);

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    mobileMq.addEventListener('change', scheduleUpdate);
    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });
    scrollEl.addEventListener('touchcancel', onTouchEnd, { passive: true });
    scrollEl.addEventListener('pointerdown', onTouchStart, { passive: true });
    window.addEventListener('pointerup', onTouchEnd);
    window.addEventListener('pointercancel', onTouchEnd);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      mobileMq.removeEventListener('change', scheduleUpdate);
      if (img) img.removeEventListener('load', scheduleUpdate);
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchend', onTouchEnd);
      scrollEl.removeEventListener('touchcancel', onTouchEnd);
      scrollEl.removeEventListener('pointerdown', onTouchStart);
      window.removeEventListener('pointerup', onTouchEnd);
      window.removeEventListener('pointercancel', onTouchEnd);
      resetMobileZoom();
    };
  }, []);

  useEffect(() => {
    const tabsEl = tabsOverlayRef.current;
    const statsEl = statsOverlayRef.current;
    const stageEl = statsEl?.closest('.mida-factory__stage');
    if (!tabsEl || !statsEl || !stageEl) {
      setStatsCompact(false);
      return undefined;
    }

    const compactMq = window.matchMedia('(max-width: 991.98px)');

    const updateStatsCompact = () => {
      if (!compactMq.matches) {
        setStatsCompact(false);
        statsFullWidthRef.current = 0;
        return;
      }

      const tabsRect = tabsEl.getBoundingClientRect();
      const stageRect = stageEl.getBoundingClientRect();
      const gap = 8;

      if (!statsCompact) {
        statsFullWidthRef.current = statsEl.getBoundingClientRect().width;
      }

      const availableWidth = stageRect.right - tabsRect.right - gap;
      const overlapsTabs = statsEl.getBoundingClientRect().left < tabsRect.right + gap;
      const needsCompact =
        overlapsTabs
        || (statsFullWidthRef.current > 0 && statsFullWidthRef.current > availableWidth);

      setStatsCompact(needsCompact);
    };

    const resizeObserver = new ResizeObserver(updateStatsCompact);
    resizeObserver.observe(tabsEl);
    resizeObserver.observe(statsEl);
    resizeObserver.observe(stageEl);

    updateStatsCompact();
    window.addEventListener('resize', updateStatsCompact);
    compactMq.addEventListener('change', updateStatsCompact);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateStatsCompact);
      compactMq.removeEventListener('change', updateStatsCompact);
    };
  }, [stats, statLabel, machineTabs, statsCompact]);

  const updatePositionFromPointer = useCallback((clientX, clientY) => {
    const id = draggingIdRef.current;
    const container = containerRef.current;
    if (!id || !container) return;

    const rect = container.getBoundingClientRect();
    const left = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const top = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    setPositions((prev) => ({ ...prev, [id]: { left, top } }));
  }, []);

  const savePosition = useCallback(async (machineId, pos) => {
    setSavingId(machineId);
    setSaveError('');
    try {
      await axios.patch(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machineId)}/layout`,
        { layout_x: pos.left, layout_y: pos.top },
        { headers: authHeaders() },
      );
      onLayoutSaved?.();
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Không lưu được vị trí. Thử lại.');
    } finally {
      setSavingId('');
    }
  }, [onLayoutSaved]);

  useEffect(() => {
    if (!editMode) return undefined;

    const onPointerMove = (event) => {
      if (!draggingIdRef.current) return;
      event.preventDefault();
      updatePositionFromPointer(event.clientX, event.clientY);
    };

    const onPointerUp = async () => {
      const id = draggingIdRef.current;
      if (!id) return;
      draggingIdRef.current = null;
      setDraggingId('');
      const pos = positionsRef.current[id];
      if (pos) await savePosition(id, pos);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [editMode, savePosition, updatePositionFromPointer]);

  const startDrag = (event, machineId) => {
    if (!editMode) return;
    event.preventDefault();
    event.stopPropagation();
    draggingIdRef.current = machineId;
    setDraggingId(machineId);
    updatePositionFromPointer(event.clientX, event.clientY);
  };

  const renderMarker = (machine, index) => {
    const pos = positions[machine.machine_id] ?? resolvePosition(machine, index);
    const statusClass = markerStatusClass(machine, now);
    const statusLabel = !isMachineConnected(machine.last_updated, now)
      ? 'Mất kết nối'
      : getMachineStatusLabel(machine.status);
    const name = machine.machine_name || machine.machine_id;
    const isSaving = savingId === machine.machine_id;
    const className = [
      'mida-factory__marker',
      `mida-factory__marker--${statusClass}`,
      editMode ? 'is-editable' : '',
      draggingId === machine.machine_id ? 'is-dragging' : '',
      isSaving ? 'is-saving' : '',
    ].filter(Boolean).join(' ');

    const style = { top: `${pos.top}%`, left: `${pos.left}%` };
    const content = <TagCallout name={name} />;

    if (editMode) {
      return (
        <button
          key={machine.machine_id}
          type="button"
          className={className}
          style={style}
          title={`${name} — kéo để đặt vị trí`}
          aria-label={`Kéo để đặt vị trí ${name}`}
          onPointerDown={(event) => startDrag(event, machine.machine_id)}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={machine.machine_id}
        to={`/mida/cnc/${encodeURIComponent(machine.machine_id)}`}
        className={className}
        style={style}
        title={`${name} — ${statusLabel}`}
        aria-label={`Xem chi tiết ${name}, ${statusLabel}`}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className={`mida-factory${editMode ? ' is-edit-mode' : ''}`}>
      <div className="mida-factory__stage" aria-label="Sơ đồ layout nhà máy">
        <div className="mida-factory__top-bar">
          <div className="mida-factory__top-left">
            {machineTabs && onTabChange && (
              <div className="mida-factory__tabs-overlay" ref={tabsOverlayRef}>
                <div className="mida-tabs mida-tabs--on-layout" role="tablist" aria-label="Loại máy MIDA">
                  {machineTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={`mida-tab${tab.id === 'ep' ? ' mida-tab--ep' : ''}${activeTab === tab.id ? ' is-active' : ''}`}
                      onClick={() => onTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {stats && statLabel && (
            <div
              className={`mida-factory__stats-overlay${statsCompact ? ' is-compact' : ''}`}
              ref={statsOverlayRef}
              aria-label="Thống kê máy"
            >
              <MidaTotalStatBar icon={Boxes} label={statLabel} value={stats.total} />
              <div className="mida-factory__stats-pills">
                <MidaStatusPill variant="run" icon={Play} label="Đang chạy" value={stats.running} />
                <MidaStatusPill variant="stop" icon={Pause} label="Dừng" value={stats.stopped} />
                <MidaStatusPill variant="offline" icon={WifiOff} label="Mất kết nối" value={stats.offline} />
              </div>
            </div>
          )}
        </div>
        <div className="mida-factory__scroll" ref={scrollRef}>
          <div className="mida-factory__zoom-wrap" ref={zoomWrapRef}>
            <div className="mida-factory__canvas" ref={containerRef}>
              <img
                src={factoryLayoutImg}
                alt="Layout nhà máy MIDA"
                className="mida-factory__map"
                draggable={false}
              />
              {sorted.map((machine, index) => renderMarker(machine, index))}
            </div>
          </div>
        </div>
      </div>
      <div className="mida-factory__bottom-left">
        <div className="mida-factory__toolbar">
          <button
            type="button"
            className={`mida-factory__edit-toggle${editMode ? ' is-active' : ''}`}
            onClick={() => {
              draggingIdRef.current = null;
              setDraggingId('');
              setEditMode((value) => !value);
              setSaveError('');
            }}
          >
            <Move size={16} aria-hidden="true" />
            {editMode ? 'Xong chỉnh vị trí' : 'Chỉnh vị trí layout'}
          </button>
          {editMode && (
            <p className="mida-factory__edit-hint">
              Kéo từng thẻ tên máy đến đúng vị trí trên hình — thả tay để lưu tự động.
            </p>
          )}
          {saveError && <p className="mida-factory__save-error">{saveError}</p>}
        </div>
      </div>
      {onCreateClick && !editMode && (
        <button
          type="button"
          className="mida-factory__fab"
          onClick={onCreateClick}
          aria-label="Tạo máy mới"
          title="Tạo máy mới"
        >
          <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
