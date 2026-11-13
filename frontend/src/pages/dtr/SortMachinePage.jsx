import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BASE_URL } from '../../config/config';
import { authHeaders, canManageDtrSortMachines } from '../../utils/auth';
import AppNavbar from '../../components/Navbar';
import {
  DTR_BOTTLE_GLOSSARY_KEYS,
  bottleGlossaryToMap,
  defaultBottleGlossaryMap,
} from '../../utils/dtrBottleGlossary';
import '../../css/DtrSortMachine.css';

const emptyForm = {
  machine_name: '',
  machine_id: '',
  location: '',
  image: null,
  tailscale_ip: '',
  port: '5173',
  api_port: '1411',
  note: '',
  handover_date: '',
  glossary: defaultBottleGlossaryMap(),
};

function toDateInputValue(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateVi(raw) {
  const iso = toDateInputValue(raw);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function SortMachinePage() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const canManage = canManageDtrSortMachines();
  const isEditing = Boolean(editingId);

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

  const closeForm = () => {
    setForm({ ...emptyForm, glossary: defaultBottleGlossaryMap() });
    setEditingId('');
    setFormOpen(false);
  };

  const openCreateForm = () => {
    if (!canManage) return;
    setEditingId('');
    setForm({ ...emptyForm, glossary: defaultBottleGlossaryMap() });
    setFormOpen(true);
    setError('');
  };

  const openEditForm = (machine) => {
    if (!canManage) return;
    setEditingId(machine.machine_id);
    setForm({
      machine_name: machine.machine_name || machine.name || '',
      machine_id: machine.machine_id || '',
      location: machine.location || '',
      image: null,
      tailscale_ip: machine.tailscale_ip || '',
      port: String(machine.port ?? 5173),
      api_port: machine.api_port != null ? String(machine.api_port) : '',
      note: machine.note || '',
      handover_date: toDateInputValue(machine.handover_date),
      glossary: bottleGlossaryToMap(machine.bottle_glossary),
    });
    setFormOpen(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onFormChange = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGlossaryChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      glossary: { ...prev.glossary, [key]: value },
    }));
  };

  const canSubmit =
    form.machine_name.trim() &&
    form.machine_id.trim() &&
    form.location.trim() &&
    form.tailscale_ip.trim() &&
    (isEditing || form.image);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManage || !canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('machine_id', form.machine_id.trim());
      formData.append('machine_name', form.machine_name.trim());
      formData.append('location', form.location.trim());
      formData.append('tailscale_ip', form.tailscale_ip.trim());
      formData.append('port', String(Number(form.port) || 5173));
      if (form.api_port.trim()) {
        formData.append('api_port', String(Number(form.api_port)));
      } else {
        formData.append('api_port', '');
      }
      formData.append('note', form.note.trim());
      formData.append('handover_date', form.handover_date || '');
      formData.append(
        'bottle_glossary',
        JSON.stringify(bottleGlossaryToMap(form.glossary)),
      );
      if (form.image) {
        formData.append('image_url', form.image);
      }

      if (isEditing) {
        await axios.put(
          `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(editingId)}`,
          formData,
          { headers: authHeaders() },
        );
      } else {
        await axios.post(`${BASE_URL}/api/portal/dtr/sort-machines`, formData, {
          headers: authHeaders(),
        });
      }
      closeForm();
      await loadMachines();
    } catch (err) {
      setError(
        err.response?.data?.error
          || (isEditing ? 'Cập nhật máy thất bại' : 'Thêm máy thất bại'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (machineId) => {
    if (!canManage) return;
    if (!window.confirm(`Xóa máy "${machineId}"?`)) return;
    setDeletingId(machineId);
    setError('');
    try {
      await axios.delete(
        `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(machineId)}`,
        { headers: authHeaders() },
      );
      if (editingId === machineId) closeForm();
      await loadMachines();
    } catch (err) {
      setError(err.response?.data?.error || 'Xóa máy thất bại');
    } finally {
      setDeletingId('');
    }
  };

  const displayName = (m) => m.machine_name || m.name || '—';

  return (
    <div className="dtr-page">
      <AppNavbar title="GIÁM SÁT MÁY SORT DTR" />

      <div className="dtr-page__body">
      <section className="dtr-page__toolbar">
        {canManage ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (formOpen) closeForm();
              else openCreateForm();
            }}
          >
            {formOpen ? 'Đóng form' : 'Thêm máy mới'}
          </button>
        ) : null}
        <button type="button" className="btn btn-outline-secondary" onClick={loadMachines} disabled={loading}>
          Làm mới
        </button>
      </section>

      {canManage && formOpen ? (
        <form className="dtr-form card shadow-sm border-0" onSubmit={handleSubmit}>
          <div className="card-body">
            <h2 className="h6 mb-3">{isEditing ? `Sửa máy — ${editingId}` : 'Thêm máy Sort'}</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-machine-name">
                  Tên máy <span className="text-danger">*</span>
                </label>
                <input
                  id="dtr-machine-name"
                  className="form-control"
                  value={form.machine_name}
                  onChange={onFormChange('machine_name')}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-machine-id">
                  ID máy <span className="text-danger">*</span>
                </label>
                <input
                  id="dtr-machine-id"
                  className="form-control"
                  value={form.machine_id}
                  onChange={onFormChange('machine_id')}
                  placeholder="VD: 25231_100_70_140_122"
                  autoComplete="off"
                  required
                  disabled={isEditing}
                  title={isEditing ? 'Không đổi được ID máy khi sửa' : undefined}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-location">
                  Nhà máy <span className="text-danger">*</span>
                </label>
                <input
                  id="dtr-location"
                  className="form-control"
                  value={form.location}
                  onChange={onFormChange('location')}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-image">
                  Hình ảnh {!isEditing ? <span className="text-danger">*</span> : null}
                  {isEditing ? (
                    <span className="text-muted fw-normal"> (để trống nếu giữ ảnh cũ)</span>
                  ) : null}
                </label>
                <input
                  id="dtr-image"
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
                  required={!isEditing}
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
                  autoComplete="off"
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="dtr-port">
                  Port frontend
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
              <div className="col-md-3">
                <label className="form-label" htmlFor="dtr-api-port">
                  Port API
                </label>
                <input
                  id="dtr-api-port"
                  className="form-control"
                  type="number"
                  min={1}
                  max={65535}
                  value={form.api_port}
                  onChange={onFormChange('api_port')}
                  placeholder="vd. 1411"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="dtr-handover-date">
                  Ngày bàn giao
                </label>
                <input
                  id="dtr-handover-date"
                  className="form-control"
                  type="date"
                  value={form.handover_date}
                  onChange={onFormChange('handover_date')}
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
                  autoComplete="off"
                />
              </div>

              <div className="col-12">
                <div className="dtr-glossary-edit">
                  <div className="dtr-glossary-edit__title">
                    Ký hiệu loại chai (biểu đồ thống kê số chai)
                  </div>
                  <p className="dtr-glossary-edit__hint mb-2">
                    Chỉnh mô tả hiển thị khi bấm nút &quot;Ký hiệu&quot; trên trang giám sát máy.
                  </p>
                  <div className="row g-2">
                    {DTR_BOTTLE_GLOSSARY_KEYS.map((item) => (
                      <div className="col-md-6" key={item.key}>
                        <label className="form-label mb-1" htmlFor={`dtr-glossary-${item.key}`}>
                          <code>{item.label}</code>
                        </label>
                        <input
                          id={`dtr-glossary-${item.key}`}
                          className="form-control form-control-sm"
                          value={form.glossary?.[item.key] ?? ''}
                          onChange={onGlossaryChange(item.key)}
                          maxLength={200}
                          autoComplete="off"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
                {saving ? 'Đang lưu…' : isEditing ? 'Cập nhật' : 'Lưu máy'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeForm}
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
            <p className="p-4 mb-0 text-muted">
              {canManage
                ? 'Chưa có máy nào. Bấm “Thêm máy mới” để bắt đầu.'
                : 'Chưa có máy nào trong danh sách.'}
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle dtr-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tên</th>
                    <th>Nhà máy</th>
                    <th>Ngày bàn giao</th>
                    <th>Tailscale</th>
                    <th>FE</th>
                    <th>API</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => {
                    const detailPath = `/dtr/sortmachine/${encodeURIComponent(m.machine_id)}`;
                    const openDetail = () => navigate(detailPath);
                    return (
                      <tr key={m.machine_id}>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none"
                            onClick={openDetail}
                            title={`Xem giám sát ${detailPath}`}
                          >
                            <code>{m.machine_id}</code>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none"
                            onClick={openDetail}
                            title={`Xem giám sát ${detailPath}`}
                          >
                            {displayName(m)}
                          </button>
                        </td>
                        <td>{m.location || '—'}</td>
                        <td>{formatDateVi(m.handover_date)}</td>
                        <td>
                          <code>{m.tailscale_ip}</code>
                        </td>
                        <td>{m.port}</td>
                        <td>{m.api_port ?? '—'}</td>
                        <td className="text-end text-nowrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary me-2"
                            onClick={openDetail}
                            title={`Xem giám sát ${detailPath}`}
                          >
                            Xem
                          </button>
                          {canManage ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary me-2"
                                onClick={() => openEditForm(m)}
                                title={`Sửa thông tin ${m.machine_id}`}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={deletingId === m.machine_id}
                                onClick={() => handleDelete(m.machine_id)}
                              >
                                {deletingId === m.machine_id ? '…' : 'Xóa'}
                              </button>
                            </>
                          ) : null}
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
    </div>
  );
}
