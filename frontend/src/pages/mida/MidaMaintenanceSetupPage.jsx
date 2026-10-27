import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import MidaNavbar from '../../components/mida/MidaNavbar';
import MidaMachineSidebar from '../../components/mida/MidaMachineSidebar';
import { BASE_URL } from '../../config/config';
import { authHeaders } from '../../utils/auth';
import '../../css/MidaCnc.css';

const FALLBACK_REASONS = [
  { code: 'thieu_nhan_su', label: 'Thiếu nhân sự' },
  { code: 'khong_ke_hoach', label: 'Không kế hoạch' },
  { code: 'setup_may', label: 'Setup máy' },
  { code: 'nghi_le_chu_nhat', label: 'Nghỉ lễ / chủ nhật' },
  { code: 'bao_tri_may', label: 'Bảo trì máy' },
  { code: 'giao_ca', label: 'Giao ca' },
  { code: 'thieu_vat_tu', label: 'Thiếu vật tư' },
  { code: 'khac', label: 'Nguyên nhân khác' },
];

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDuration(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours <= 0 && minutes <= 0) return '0 phút';
  if (hours <= 0) return `${minutes} phút`;
  if (minutes <= 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

function durationFromTimes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return (endMin - startMin) * 60;
}

export default function MidaMaintenanceSetupPage() {
  const { machine_id } = useParams();
  const navigate = useNavigate();
  const [width, setWidth] = useState(window.innerWidth);
  const [machines, setMachines] = useState([]);
  const [machine, setMachine] = useState(null);
  const [date, setDate] = useState(todayKey);
  const [events, setEvents] = useState([]);
  const [reasons, setReasons] = useState(FALLBACK_REASONS);
  const [setupSeconds, setSetupSeconds] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reasonCode, setReasonCode] = useState('setup_may');
  const [reasonNote, setReasonNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchMachines = useCallback(async () => {
    const res = await axios.get(`${BASE_URL}/api/portal/mida/cnc-machines`, {
      headers: authHeaders(),
      params: { type: 'cnc' },
    });
    setMachines(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchMachine = useCallback(async () => {
    if (!machine_id) return;
    const res = await axios.get(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}`,
      { headers: authHeaders() },
    );
    setMachine(res.data || null);
  }, [machine_id]);

  const fetchDowntime = useCallback(async () => {
    if (!machine_id || !date) return;
    const res = await axios.get(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}/downtime`,
      { headers: authHeaders(), params: { date } },
    );
    setEvents(Array.isArray(res.data?.events) ? res.data.events : []);
    setSetupSeconds(Number(res.data?.setup_seconds) || 0);
    if (Array.isArray(res.data?.reasons) && res.data.reasons.length > 0) {
      setReasons(res.data.reasons);
    }
  }, [machine_id, date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        await Promise.all([fetchMachines(), fetchMachine(), fetchDowntime()]);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Không tải được dữ liệu máy');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchMachines, fetchMachine, fetchDowntime]);

  const previewDuration = useMemo(
    () => durationFromTimes(startTime, endTime),
    [startTime, endTime],
  );

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axios.post(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}/downtime`,
        {
          date,
          start_time: startTime,
          end_time: endTime,
          reason_code: reasonCode,
          reason_note: reasonNote,
        },
        { headers: authHeaders() },
      );
      setStartTime('');
      setEndTime('');
      setReasonNote('');
      await fetchDowntime();
      setMessage('Đã lưu khoảng dừng máy');
    } catch (err) {
      setError(err.response?.data?.error || 'Không lưu được khoảng dừng máy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Xóa khoảng dừng này?')) return;
    setError('');
    setMessage('');
    try {
      await axios.delete(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}/downtime/${eventId}`,
        { headers: authHeaders() },
      );
      await fetchDowntime();
      setMessage('Đã xóa khoảng dừng');
    } catch (err) {
      setError(err.response?.data?.error || 'Không xóa được khoảng dừng');
    }
  };

  const name = machine?.machine_name || machine_id || 'Máy CNC';

  return (
    <div className="mida-page mida-page--detail mida-page--maintenance">
      <MidaNavbar />
      <div className="mida-page__body d-flex flex-nowrap mida-page__body--detail">
        <MidaMachineSidebar
          machines={machines}
          navigate={navigate}
          width={width}
          selectedMachineId={machine_id}
        />
        <div className="flex-grow-1 mida-detail__main">
          <div className="mida-maint">
            <div className="mida-maint__card mida-maint__card--wide">
              <h2 className="mida-maint__title">Nhật ký dừng máy</h2>
              <p className="mida-maint__machine">{name}</p>
              <p className="mida-maint__hint">
                Nhập giờ bắt đầu, giờ kết thúc và nguyên nhân. Chỉ các khoảng
                {' '}<strong>Setup máy</strong> được cộng vào biểu đồ thời gian setup.
              </p>

              {width <= 1200 && machines.length > 0 ? (
                <label className="mida-maint__field">
                  <span>Máy</span>
                  <select
                    className="mida-maint__input"
                    value={machine_id}
                    onChange={(e) => navigate(`/mida/cnc/${e.target.value}`)}
                  >
                    {machines.map((m) => (
                      <option key={m.machine_id} value={m.machine_id}>
                        {m.machine_name || m.machine_id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {loading ? <p className="mida-maint__status">Đang tải…</p> : null}
              {error ? <p className="mida-maint__error">{error}</p> : null}
              {message ? <p className="mida-maint__ok">{message}</p> : null}

              <form className="mida-maint__form" onSubmit={handleSave}>
                <label className="mida-maint__field">
                  <span>Ngày</span>
                  <input
                    type="date"
                    className="mida-maint__input"
                    value={date}
                    max={todayKey()}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </label>
                <div className="mida-maint__row">
                  <label className="mida-maint__field">
                    <span>Bắt đầu</span>
                    <input
                      type="time"
                      className="mida-maint__input"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </label>
                  <label className="mida-maint__field">
                    <span>Kết thúc</span>
                    <input
                      type="time"
                      className="mida-maint__input"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className="mida-maint__field">
                  <span>Nguyên nhân dừng máy</span>
                  <select
                    className="mida-maint__input"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    required
                  >
                    {reasons.map((reason) => (
                      <option key={reason.code} value={reason.code}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
                {reasonCode === 'khac' ? (
                  <label className="mida-maint__field">
                    <span>Mô tả nguyên nhân khác</span>
                    <input
                      type="text"
                      className="mida-maint__input"
                      value={reasonNote}
                      onChange={(e) => setReasonNote(e.target.value)}
                      placeholder="Nhập nguyên nhân…"
                      required
                    />
                  </label>
                ) : null}
                <p className="mida-maint__saved">
                  Thời lượng: <strong>{formatDuration(previewDuration)}</strong>
                  {endTime && startTime && endTime <= startTime
                    ? ' (qua ngày hôm sau)'
                    : ''}
                </p>
                <button type="submit" className="mida-maint__save" disabled={saving || loading}>
                  {saving ? 'Đang lưu…' : 'Thêm khoảng dừng'}
                </button>
              </form>

              <div className="mida-maint__history">
                <h3 className="mida-maint__history-title">Lịch sử trong ngày</h3>
                <p className="mida-maint__saved">
                  Tổng setup: <strong>{formatDuration(setupSeconds)}</strong>
                </p>
                {events.length === 0 && !loading ? (
                  <p className="mida-maint__status">Chưa có khoảng dừng nào.</p>
                ) : (
                  <ul className="mida-maint__list">
                    {events.map((item) => (
                      <li key={item.id} className="mida-maint__item">
                        <div>
                          <strong>{item.start_time} – {item.end_time}</strong>
                          <span> · {item.reason_label}</span>
                          {item.reason_note ? <span> ({item.reason_note})</span> : null}
                          <div className="mida-maint__item-meta">
                            {formatDuration(item.duration_seconds)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="mida-maint__delete"
                          onClick={() => handleDelete(item.id)}
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
