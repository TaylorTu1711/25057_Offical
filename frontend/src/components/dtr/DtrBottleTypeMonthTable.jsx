import React, { useMemo } from 'react';
import MidaChartExpand from '../mida/MidaChartExpand';
import { resolveBottleGlossary } from '../../utils/dtrBottleGlossary';

/** Thứ tự hiển thị + nhóm (separator sau mỗi group). */
const ROW_ORDER = [
  'b1_kn', 'b1_oh', 'b1_nl', 'b1_nn',
  'b4_kn', 'b4_oh', 'b4_nl', 'b4_nn',
  'b5_kn', 'b5_nl', 'b5_nn',
  'hu_kn', 'hu_nl',
  'ptp', 'no_classify',
];

/** Ẩn khỏi bảng giám sát (vẫn có thể còn trong telemetry). */
const TABLE_EXCLUDED_KEYS = new Set(['zz_cochai', 'zz_nap']);

const GROUP_BREAK_AFTER = new Set(['b1_nn', 'b4_nn', 'b5_nn', 'hu_nl']);

const MODE_PERIOD_WORD = {
  hour: 'giờ',
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
  quarter: 'quý',
  year: 'năm',
};

function fmtInt(n) {
  return Number(n || 0).toLocaleString('vi-VN');
}

function fmtPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0%';
  return `${v.toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function sumCounts(counts = {}) {
  return Object.entries(counts).reduce((s, [key, v]) => {
    if (TABLE_EXCLUDED_KEYS.has(String(key).toLowerCase())) return s;
    return s + (Number(v) || 0);
  }, 0);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Nhãn cột thân thiện theo mode (T1…, Q1…, 00h…). */
function formatColumnLabel(raw, mode) {
  const s = String(raw ?? '').trim();
  if (!s) return '—';

  if (mode === 'month') {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return `T${n}`;
  }
  if (mode === 'week') {
    if (/^T\d+$/i.test(s)) return s.toUpperCase();
    const n = Number(s);
    if (Number.isFinite(n) && n >= 1) return `T${n}`;
  }
  if (mode === 'quarter') {
    if (/^Q\d+$/i.test(s)) return s.toUpperCase();
    const n = Number(s);
    if (Number.isFinite(n) && n >= 1 && n <= 4) return `Q${n}`;
  }
  return s;
}

function buildTitle({ mode, year, month, day }) {
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;
  const d = day || new Date().getDate();

  switch (mode) {
    case 'hour':
      return `BẢNG THỐNG KÊ SỐ CHAI (${pad2(d)}/${pad2(m)}/${y})`;
    case 'day':
    case 'week':
      return `BẢNG THỐNG KÊ SỐ CHAI (${pad2(m)}/${y})`;
    case 'month':
    case 'quarter':
      return `BẢNG THỐNG KÊ SỐ CHAI (${y})`;
    case 'year':
      return 'BẢNG THỐNG KÊ SỐ CHAI (theo năm)';
    default:
      return `BẢNG THỐNG KÊ SỐ CHAI (${y})`;
  }
}

function buildHint(mode) {
  const period = MODE_PERIOD_WORD[mode] || 'kỳ';
  return `Mỗi ô: số chai thực tế và % của loại đó trong ${period}. Dòng Tổng: số chai và % của ${period} trên toàn khoảng.`;
}

/**
 * Bảng thống kê loại chai theo buckets (giờ / ngày / tuần / tháng / quý / năm).
 * Mỗi ô: số chai + % loại trong cột. Dòng Tổng: tổng cột + % trên cả khoảng.
 */
export default function DtrBottleTypeMonthTable({
  mode = 'month',
  year,
  month,
  day,
  keys = [],
  buckets = [],
  expandable = true,
  bottleGlossary = null,
}) {
  const glossaryByKey = useMemo(() => {
    const map = {};
    for (const item of resolveBottleGlossary(bottleGlossary)) {
      const code = String(item.key).toLowerCase();
      map[code] = String(item.meaning || item.label || item.key).trim()
        || String(item.key).toUpperCase();
    }
    return map;
  }, [bottleGlossary]);

  const model = useMemo(() => {
    const cols = (buckets || []).map((b, index) => {
      const counts = b?.counts || {};
      return {
        index,
        label: formatColumnLabel(b?.label, mode),
        counts,
        colTotal: sumCounts(counts),
      };
    });

    const keySet = new Set(
      (keys || [])
        .map((k) => String(k).toLowerCase())
        .filter((k) => !TABLE_EXCLUDED_KEYS.has(k)),
    );
    for (const c of cols) {
      Object.keys(c.counts || {}).forEach((k) => {
        const code = String(k).toLowerCase();
        if (!TABLE_EXCLUDED_KEYS.has(code)) keySet.add(code);
      });
    }

    const ordered = [
      ...ROW_ORDER.filter((k) => keySet.has(k)),
      ...[...keySet].filter((k) => !ROW_ORDER.includes(k)).sort(),
    ];

    const grandTotal = cols.reduce((s, c) => s + c.colTotal, 0);

    const rows = ordered
      .map((key) => {
        const cells = cols.map((c) => {
          const count = Number(c.counts?.[key]) || 0;
          const pct = c.colTotal > 0 ? (count / c.colTotal) * 100 : 0;
          return { count, pct };
        });
        const rowTotal = cells.reduce((s, cell) => s + cell.count, 0);
        const rowPct = grandTotal > 0 ? (rowTotal / grandTotal) * 100 : 0;
        const code = String(key).toLowerCase();
        return {
          key,
          label: glossaryByKey[code] || String(key).toUpperCase(),
          code: String(key).toUpperCase(),
          cells,
          rowTotal,
          rowPct,
          breakAfter: GROUP_BREAK_AFTER.has(key),
        };
      })
      .filter((row) => row.key !== 'no_classify' || row.rowTotal > 0);

    const totalCells = cols.map((c) => ({
      count: c.colTotal,
      pct: grandTotal > 0 ? (c.colTotal / grandTotal) * 100 : 0,
    }));

    return {
      cols,
      rows,
      totalCells,
      grandTotal,
      title: buildTitle({ mode, year, month, day }),
      hint: buildHint(mode),
    };
  }, [keys, buckets, mode, year, month, day, glossaryByKey]);

  return (
    <div className="dtr-bottle-month-table">
      <div className="dtr-bottle-month-table__head">
        {expandable ? (
          <div className="dtr-bottle-month-table__title-row">
            <div className="dtr-bottle-month-table__title">{model.title}</div>
            <MidaChartExpand title={model.title} tone="plenma" variant="table">
              <DtrBottleTypeMonthTable
                mode={mode}
                year={year}
                month={month}
                day={day}
                keys={keys}
                buckets={buckets}
                bottleGlossary={bottleGlossary}
                expandable={false}
              />
            </MidaChartExpand>
          </div>
        ) : null}
        <div className="dtr-bottle-month-table__hint">{model.hint}</div>
      </div>

      <div className="dtr-bottle-month-table__scroll">
        <table className="dtr-bottle-month-table__table">
          <thead>
            <tr>
              <th className="dtr-bottle-month-table__sticky">Loại</th>
              {model.cols.map((col) => (
                <th key={`h-${col.index}`}>{col.label}</th>
              ))}
              <th>Tổng</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr
                key={row.key}
                className={row.breakAfter ? 'dtr-bottle-month-table__row--break' : undefined}
              >
                <td
                  className="dtr-bottle-month-table__sticky dtr-bottle-month-table__type"
                  title={row.code}
                >
                  {row.label}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={`${row.key}-${i}`}>
                    <div className="dtr-bottle-month-table__cell">
                      <span className="dtr-bottle-month-table__count">{fmtInt(cell.count)}</span>
                      {cell.count > 0 ? (
                        <span className="dtr-bottle-month-table__pct">{fmtPct(cell.pct)}</span>
                      ) : null}
                    </div>
                  </td>
                ))}
                <td>
                  <div className="dtr-bottle-month-table__cell">
                    <span className="dtr-bottle-month-table__count">{fmtInt(row.rowTotal)}</span>
                    {row.rowTotal > 0 ? (
                      <span className="dtr-bottle-month-table__pct">{fmtPct(row.rowPct)}</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="dtr-bottle-month-table__total">
              <td className="dtr-bottle-month-table__sticky dtr-bottle-month-table__type">
                Tổng
              </td>
              {model.totalCells.map((cell, i) => (
                <td key={`total-${i}`}>
                  <div className="dtr-bottle-month-table__cell">
                    <span className="dtr-bottle-month-table__count">{fmtInt(cell.count)}</span>
                    {cell.count > 0 ? (
                      <span className="dtr-bottle-month-table__pct">{fmtPct(cell.pct)}</span>
                    ) : null}
                  </div>
                </td>
              ))}
              <td>
                <div className="dtr-bottle-month-table__cell">
                  <span className="dtr-bottle-month-table__count">{fmtInt(model.grandTotal)}</span>
                  {model.grandTotal > 0 ? (
                    <span className="dtr-bottle-month-table__pct">{fmtPct(100)}</span>
                  ) : null}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
