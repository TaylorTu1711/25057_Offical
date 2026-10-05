/**
 * Thanh Gantt trạng thái 24h (xanh = chạy, đỏ = dừng, vàng = chưa kết nối).
 * status: 2=run, 1=stop, 0=offline
 */
export default function MidaStatusGanttBar({ segments = [] }) {
  const items = Array.isArray(segments) && segments.length > 0
    ? segments
    : [{ status: 0, pct: 100 }];

  return (
    <div className="mida-status-gantt" role="img" aria-label="Trạng thái 24h gần nhất">
      {items.map((seg, index) => {
        const kind =
          seg.status === 2 ? 'run' : seg.status === 1 ? 'stop' : 'offline';
        return (
          <span
            key={`${kind}-${index}`}
            className={`mida-status-gantt__seg mida-status-gantt__seg--${kind}`}
            style={{ flexGrow: Math.max(0.01, Number(seg.pct) || 0), flexBasis: 0 }}
          />
        );
      })}
    </div>
  );
}
