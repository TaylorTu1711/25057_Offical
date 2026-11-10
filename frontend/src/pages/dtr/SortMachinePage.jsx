import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BASE_URL } from '../../config/config';
import { authHeaders, logout } from '../../utils/auth';
import {
  buildDtrPublicPath,
  buildDtrTailscaleUrl,
  openDtrTailscaleMachine,
} from '../../utils/dtrSortMachine';
import '../../css/DtrSortMachine.css';

const emptyForm = {
  machine_id: '',
  name: '',
  tailscale_ip: '',
  port: '5173',
  note: '',
};

export default function SortMachinePage() {
  const navigate = useNavigate();
  const email = typeof localStorage !== 'undefined' ? localStorage.getItem('email') : '';
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const loadMachines = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${BASE_URL}/api/portal/dtr/sort-machines`, {
        headers: authHeaders(),
      });
      setMachines(res.data?.machines || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Không tải được danh sách máy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const onFormChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.post(
        `${BASE_URL}/api/portal/dtr/sort-machines`,
        {
          machine_id: form.machine_id.trim(),
          name: form.name.trim(),
          tailscale_ip: form.tailscale_ip.trim(),
          port: Number(form.port) || 5173,
          note: form.note.trim() || null,
        },
        { headers: authHeaders() },
      );
      setForm(emptyForm);
      setFormOpen(false);
      await loadMachines();
    } catch (err) {
      setError(err.response?.data?.error || 'Thêm máy thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (machineId) => {
    if (!window.confirm(`Xóa máy "${machineId}"?`)) return;
    setDeletingId(machineId);
    setError('');
    try {
      await axios.delete(
        `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(machineId)}`,
        { headers: authHeaders() },
      );
      await loadMachines();
    } catch (err) {
      setError(err.response?.data?.error || 'Xóa máy thất bại');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="dtr-page">
      <header className="dtr-page__header">
        <div>
          <p className="dtr-page__eyebrow">DTR Portal</p>
          <h1 className="dtr-page__title">Sort Machine</h1>
          <p className="dtr-page__sub">
            Mỗi máy có ID + IP Tailscale. Bấm Mở để vào{' '}
            <code>/dtr/sortmachine/&lt;id&gt;/</code> qua domain — thiết bị
            người dùng không cần cài Tailscale.
          </p>
        </div>
        <div className="dtr-page__header-actions">
          <span className="dtr-page__user">{email || '—'}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <section className="dtr-page__toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormOpen((open) => !open);
            setError('');
          }}
        >
          {formOpen ? 'Đóng form' : 'Thêm máy mới'}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={loadMachines} disabled={loading}>
          Làm mới
        </button>
      </section>

      {formOpen ? (
        <form className="dtr-form card shadow-sm border-0" onSubmit={handleCreate}>
          <div className="card-body">
            <h2 className="h6 mb-3">Thêm máy Sort</h2>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label" htmlFor="dtr-machine-id">
                  Machine ID <span className="text-danger">*</span>
                </label>
                <input
                  id="dtr-machine-id"
                  className="form-control"
                  value={form.machine_id}
                  onChange={onFormChange('machine_id')}
                  placeholder="vd. 25231"
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="dtr-name">
                  Tên máy
                </label>
                <input
                  id="dtr-name"
                  className="form-control"
                  value={form.name}
                  onChange={onFormChange('name')}
                  placeholder="Tên hiển thị"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="dtr-port">
                  Port
                </label>
                <input
                  id="dtr-port"
                  className="form-control"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={onFormChange('port')}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-tailscale">
                  Tailscale IP <span className="text-danger">*</span>
                </label>
                <input
                  id="dtr-tailscale"
                  className="form-control"
                  value={form.tailscale_ip}
                  onChange={onFormChange('tailscale_ip')}
                  placeholder="vd. 100.70.140.122"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-note">
                  Ghi chú
                </label>
                <input
                  id="dtr-note"
                  className="form-control"
                  value={form.note}
                  onChange={onFormChange('note')}
                  placeholder="Tùy chọn"
                />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu máy'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setForm(emptyForm);
                  setFormOpen(false);
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <section className="dtr-table-wrap card shadow-sm border-0">
        <div className="card-body p-0">
          {loading ? (
            <p className="p-4 mb-0 text-muted">Đang tải danh sách máy…</p>
          ) : machines.length === 0 ? (
            <p className="p-4 mb-0 text-muted">Chưa có máy nào. Bấm “Thêm máy mới” để bắt đầu.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle dtr-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tên</th>
                    <th>Tailscale</th>
                    <th>Port</th>
                    <th>Đường dẫn</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => {
                    const path = buildDtrPublicPath(m.machine_id);
                    const tailscaleUrl = buildDtrTailscaleUrl(m);
                    return (
                      <tr key={m.machine_id}>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none"
                            onClick={() => openDtrTailscaleMachine(m)}
                            title={`Mở ${path}`}
                          >
                            <code>{m.machine_id}</code>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none"
                            onClick={() => openDtrTailscaleMachine(m)}
                            title={`Mở ${path}`}
                          >
                            {m.name || '—'}
                          </button>
                        </td>
                        <td>
                          <code>{m.tailscale_ip}</code>
                        </td>
                        <td>{m.port}</td>
                        <td>
                          <a href={path} title="Mở qua domain (proxy Tailscale)">
                            {path}
                          </a>
                          <div className="small text-muted">Upstream: {tailscaleUrl}</div>
                        </td>
                        <td className="text-end text-nowrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => openDtrTailscaleMachine(m)}
                            title={`Mở ${path}`}
                          >
                            Mở
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={deletingId === m.machine_id}
                            onClick={() => handleDelete(m.machine_id)}
                          >
                            {deletingId === m.machine_id ? '…' : 'Xóa'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
