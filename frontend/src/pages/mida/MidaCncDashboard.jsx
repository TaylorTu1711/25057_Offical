import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Pause, Play, WifiOff } from 'lucide-react';
import axios from 'axios';
import { BASE_URL } from '../../config/config';
import { authHeaders } from '../../utils/auth';
import { POLL_INTERVALS } from '../../config/polling';
import usePolling from '../../hooks/usePolling';
import useNow from '../../hooks/useNow';
import { isMachineConnected, isMachineRunning } from '../../utils/machineStatus';
import MidaNavbar from '../../components/mida/MidaNavbar';
import MidaFactoryLayout from '../../components/mida/MidaFactoryLayout';
import MidaMachineCard from '../../components/mida/MidaMachineCard';
import MidaCreateMachineModal from '../../components/mida/MidaCreateMachineModal';
import MidaTotalStatBar from '../../components/mida/MidaTotalStatBar';
import MidaStatusPill from '../../components/mida/MidaStatusPill';
import '../../css/MidaCnc.css';

// Tạm ẩn tab CNC / Máy ép — chỉ hiển thị CNC. Bật lại MACHINE_TABS + setActiveTab khi cần.
const ACTIVE_MACHINE_TYPE = 'cnc';
const MACHINE_TABS = [
  { id: 'cnc', label: 'Máy CNC', statLabel: 'Tổng máy CNC', emptyTitle: 'Chưa có máy CNC' },
  { id: 'ep', label: 'Máy ép', statLabel: 'Tổng máy ép', emptyTitle: 'Chưa có máy ép' },
];

export default function MidaCncDashboard() {
  const now = useNow(POLL_INTERVALS.connectionTick);
  const activeTab = ACTIVE_MACHINE_TYPE;
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const tabMeta = MACHINE_TABS.find((t) => t.id === activeTab) ?? MACHINE_TABS[0];

  const fetchMachines = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/portal/mida/cnc-machines`, {
        headers: authHeaders(),
        params: { type: activeTab },
      });
      setMachines(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      setMachines([]);
      setError(err.response?.data?.error || `Không tải được danh sách ${tabMeta.label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, tabMeta.label]);

  useEffect(() => {
    setLoading(true);
    fetchMachines();
  }, [fetchMachines]);

  usePolling(fetchMachines, POLL_INTERVALS.status, true);

  const stats = useMemo(() => {
    let running = 0;
    let stopped = 0;
    let offline = 0;
    machines.forEach((m) => {
      if (!isMachineConnected(m.last_updated, now)) offline += 1;
      else if (isMachineRunning(m.status)) running += 1;
      else stopped += 1;
    });
    return { total: machines.length, running, stopped, offline };
  }, [machines, now]);

  const handleDeleteMachine = async (machine) => {
    const name = machine.machine_name || machine.machine_id;
    if (!window.confirm(`Bạn có chắc muốn xoá máy "${name}"?`)) return;

    try {
      await axios.delete(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine.machine_id)}`,
        { headers: authHeaders() },
      );
      fetchMachines();
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xoá máy. Vui lòng thử lại.');
    }
  };

  return (
    <div className={`mida-page${activeTab === 'cnc' ? ' mida-page--factory' : ''}`}>
      <MidaNavbar />
      <main className={`mida-main${activeTab === 'cnc' ? ' mida-main--factory' : ''}`}>
        {activeTab !== 'cnc' && (
          <div className="mida-toolbar">
            <div className="mida-toolbar__cluster">
              <div className="mida-toolbar__status-pills">
                <MidaStatusPill variant="run" icon={Play} label="Đang chạy" value={stats.running} />
                <MidaStatusPill variant="stop" icon={Pause} label="Dừng" value={stats.stopped} />
                <MidaStatusPill variant="offline" icon={WifiOff} label="Mất kết nối" value={stats.offline} />
              </div>
              <div className="mida-toolbar__footer">
                <MidaTotalStatBar
                  icon={Boxes}
                  label={tabMeta.statLabel}
                  value={stats.total}
                />
                <button type="button" className="mida-add-btn" onClick={() => setIsCreateOpen(true)}>
                  + Tạo máy mới
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && activeTab !== 'cnc' && <p className="mida-empty">Đang tải...</p>}
        {!loading && error && (
          <div className="mida-empty">
            <h2>{error}</h2>
          </div>
        )}
        {!loading && !error && machines.length === 0 && activeTab !== 'cnc' && (
          <div className="mida-empty">
            <h2>{tabMeta.emptyTitle}</h2>
            <p>Nhấn &quot;Tạo máy mới&quot; để thêm {tabMeta.label.toLowerCase()} đầu tiên.</p>
          </div>
        )}
        {activeTab === 'cnc' && !error && (
          <MidaFactoryLayout
            machines={machines}
            now={now}
            onLayoutSaved={fetchMachines}
            statLabel={tabMeta.statLabel}
            stats={stats}
            onCreateClick={() => setIsCreateOpen(true)}
          />
        )}
        {!loading && !error && machines.length > 0 && activeTab === 'ep' && (
          <div className="mida-grid">
            {machines.map((m) => (
              <MidaMachineCard
                key={m.machine_id}
                machine={m}
                now={now}
                machineType={activeTab}
                onDelete={handleDeleteMachine}
              />
            ))}
          </div>
        )}
      </main>
      <MidaCreateMachineModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={fetchMachines}
        machineType={activeTab}
      />
    </div>
  );
}
