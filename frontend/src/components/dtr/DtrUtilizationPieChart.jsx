import React, { useId, useMemo } from 'react';
import MidaChartExpand from '../mida/MidaChartExpand';

const VIEW = 220;
const CX = 110;
const CY = 108;
const R = 100;

const COLORS = {
  run: '#22c55e',
  runDeep: '#16a34a',
  stop: '#ef4444',
  stopDeep: '#dc2626',
};

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

function polar(cx, cy, r, degFromTopClockwise) {
  const rad = ((degFromTopClockwise - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeWedge(cx, cy, r, startDeg, endDeg) {
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  if (sweep < 0.4) return '';
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  if (sweep >= 359.6) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

function labelPos(midDeg) {
  const p = polar(CX, CY, R * 0.55, midDeg);
  return {
    x: Math.min(VIEW - 42, Math.max(42, p.x)),
    y: Math.min(VIEW - 20, Math.max(20, p.y)),
  };
}

function roundPct(n) {
  return Number((Number(n) || 0).toFixed(2));
}

/**
 * Pie hiệu suất DTR — giao diện giống Mida (Cắt gọt/Ngưng):
 * quạt đặc + badge %, chú thích Chạy / Dừng.
 */
export default function DtrUtilizationPieChart({
  utilizationPct = 0,
  title = 'HIỆU SUẤT SỬ DỤNG',
  expandable = true,
  /** Thu nhỏ để nhét vào thẻ KPI (không hiện chữ tiêu đề). */
  compact = false,
}) {
  const uid = useId().replace(/:/g, '');

  const { runPct, stopPct } = useMemo(() => {
    const run = roundPct(Math.min(100, Math.max(0, Number(utilizationPct) || 0)));
    return { runPct: run, stopPct: roundPct(Math.max(0, 100 - run)) };
  }, [utilizationPct]);

  const slices = useMemo(() => {
    const defs = [
      {
        key: 'run',
        pct: runPct,
        fill: `url(#dtrUtilRunGrad-${uid})`,
        stroke: COLORS.runDeep,
        label: 'Chạy',
      },
      {
        key: 'stop',
        pct: stopPct,
        fill: `url(#dtrUtilStopGrad-${uid})`,
        stroke: COLORS.stopDeep,
        label: 'Dừng',
      },
    ];
    let cursor = 0;
    return defs.map((slice) => {
      const sweep = clamp01(slice.pct / 100) * 360;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;
      return {
        ...slice,
        sweep,
        path: describeWedge(CX, CY, R, start, end),
        badge: labelPos(start + sweep / 2),
        show: sweep > 1,
      };
    });
  }, [runPct, stopPct, uid]);

  const empty = runPct <= 0 && stopPct <= 0;

  const chartInner = (
    <div className="dtr-util-mida" key={`${runPct}-${stopPct}`}>
      <div className="dtr-util-mida__chart">
        {empty ? (
          <div className="dtr-util-mida__empty">Chưa có dữ liệu</div>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="dtr-util-mida__svg dtr-util-mida__svg--anim"
            role="img"
            aria-label={`Chạy ${runPct}%, Dừng ${stopPct}%`}
          >
            <defs>
              <radialGradient id={`dtrUtilRunGrad-${uid}`} cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor={COLORS.runDeep} />
              </radialGradient>
              <radialGradient id={`dtrUtilStopGrad-${uid}`} cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor={COLORS.stopDeep} />
              </radialGradient>
              <filter id={`dtrUtilSoftShadow-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#94a3b8" floodOpacity="0.35" />
              </filter>
              <filter id={`dtrUtilBadgeShadow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodOpacity="0.28" />
              </filter>
            </defs>

            <g filter={`url(#dtrUtilSoftShadow-${uid})`}>
              {slices.map((slice) => (
                slice.show ? (
                  <path
                    key={slice.key}
                    d={slice.path}
                    fill={slice.fill}
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                ) : null
              ))}
            </g>

            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#ffffff" strokeWidth="2.5" />

            {slices.map((slice) => (
              slice.show ? (
                <g key={`${slice.key}-badge`} filter={`url(#dtrUtilBadgeShadow-${uid})`}>
                  <rect
                    x={slice.badge.x - 36}
                    y={slice.badge.y - 14}
                    width="72"
                    height="28"
                    rx="8"
                    fill={slice.stroke}
                  />
                  <text
                    x={slice.badge.x}
                    y={slice.badge.y + 5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="14"
                    fontWeight="800"
                  >
                    {slice.pct}%
                  </text>
                </g>
              ) : null
            ))}
          </svg>
        )}
      </div>
      {!empty ? (
        <div className="dtr-util-mida__legend">
          <span className="dtr-util-mida__legend-item dtr-util-mida__legend-item--run">
            <i aria-hidden="true" /> Chạy
          </span>
          <span className="dtr-util-mida__legend-item dtr-util-mida__legend-item--stop">
            <i aria-hidden="true" /> Dừng
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={`dtr-pie-card dtr-util-pie d-flex flex-column min-h-0${
        compact ? ' dtr-util-pie--compact' : ' card shadow'
      }`}
    >
      {expandable ? (
        <div className="dtr-util-pie__expand">
          <MidaChartExpand title={title} tone="plenma" variant="pie">
            <DtrUtilizationPieChart
              utilizationPct={utilizationPct}
              title={title}
              expandable={false}
            />
          </MidaChartExpand>
        </div>
      ) : null}
      <div className="dtr-pie-card__body flex-grow-1 min-h-0 d-flex align-items-center justify-content-center">
        {chartInner}
      </div>
    </div>
  );
}
