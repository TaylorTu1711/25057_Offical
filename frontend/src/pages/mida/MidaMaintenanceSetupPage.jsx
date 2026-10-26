import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import MidaNavbar from '../../components/mida/MidaNavbar';
import MidaMachineSidebar from '../../components/mida/MidaMachineSidebar';
import { BASE_URL } from '../../config/config';
import { authHeaders } from '../../utils/auth';
import '../../css/MidaCnc.css';

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function secondsToHm(total) {
  const sec = Math.max(0, Number(total) || 0);
  return {
    hours: Math.floor(sec / 3600),
    minutes: Math.floor((sec % 3600) / 60),
  };
}

function formatDuration(seconds) {
  const { hours, minutes } = secondsToHm(seconds);
  if (hours <= 0 && minutes <= 0) return '0 phút';
  if (hours <= 0) return `${minutes} phút`;
  if (minutes <= 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

export default function MidaMaintenanceSetupPage() {
  const { machine_id } = useParams();
  const navigate = useNavigate();
  const [width, setWidth] = useState(window.innerWidth);
  const [machines, setMachines] = useState([]);
  const [machine, setMachine] = useState(null);
  const [date, setDate] = useState(todayKey);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [savedSeconds, setSavedSeconds] = useState(0);
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

  const fetchSetup = useCallback(async () => {
    if (!machine_id || !date) return;
    const res = await axios.get(
      `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}/daily-setup`,
      { headers: authHeaders(), params: { date } },
    );
    const seconds = Number(res.data?.setup_seconds) || 0;
    const hm = secondsToHm(seconds);
    setSavedSeconds(seconds);
    setHours(hm.hours);
    setMinutes(hm.minutes);
  }, [machine_id, date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        await Promise.all([fetchMachines(), fetchMachine(), fetchSetup()]);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Không tải được dữ liệu máy');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchMachines, fetchMachine, fetchSetup]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.put(
        `${BASE_URL}/api/portal/mida/cnc-machines/${encodeURIComponent(machine_id)}/daily-setup`,
        { date, hours: Number(hours) || 0, minutes: Number(minutes) || 0 },
        { headers: authHeaders() },
      );
      const seconds = Number(res.data?.setup_seconds) || 0;
      setSavedSeconds(seconds);
      const hm = secondsToHm(seconds);
      setHours(hm.hours);
      setMinutes(hm.minutes);
      setMessage(`Đã lưu setup ${formatDuration(seconds)} cho ngày ${date}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Không lưu được thời gian setup');
    } finally {
      setSaving(false);
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
            <div className="mida-maint__card">
              <h2 className="mida-maint__title">Nhập thời gian setup</h2>
              <p className="mida-maint__machine">{name}</p>
              <p className="mida-maint__hint">
                Chỉ nhập tổng thời gian setup của máy trong ngày đã chọn.
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
                    <span>Giờ</span>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      className="mida-maint__input"
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
                    />
                  </label>
                  <label className="mida-maint__field">
                    <span>Phút</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      className="mida-maint__input"
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                    />
                  </label>
                </div>
                <p className="mida-maint__saved">
                  Đã lưu: <strong>{formatDuration(savedSeconds)}</strong>
                </p>
                <button type="submit" className="mida-maint__save" disabled={saving || loading}>
                  {saving ? 'Đang lưu…' : 'Lưu thời gian setup'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
