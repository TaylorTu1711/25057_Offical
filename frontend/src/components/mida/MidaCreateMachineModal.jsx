import { useMemo, useState } from 'react';
import axios from 'axios';
import { BASE_URL } from '../../config/config';
import { authHeaders, getLocations, getRole } from '../../utils/auth';
import '../../css/AppModal.css';

const defaultForm = () => {
  const locations = getLocations();
  return {
    machine_id: '',
    machine_name: '',
    location: locations[0] || 'MIDA',
    image: null,
  };
};

export default function MidaCreateMachineModal({ open, onClose, onCreated, machineType = 'cnc' }) {
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const locations = useMemo(() => getLocations(), [open]);
  const isAdmin = getRole() === 'admin';
  const canSubmit = form.machine_id.trim() && form.machine_name.trim() && form.location.trim();

  const isEp = machineType === 'ep';
  const typeLabel = isEp ? 'ép' : 'CNC';

  if (!open) return null;

  const handleClose = () => {
    if (submitting) return;
    setForm(defaultForm());
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('machine_id', form.machine_id.trim());
      formData.append('machine_name', form.machine_name.trim());
      formData.append('location', form.location.trim());
      formData.append('machine_type', machineType);
      if (form.image) {
        formData.append('image_url', form.image);
      }

      await axios.post(`${BASE_URL}/api/portal/mida/machines`, formData, {
        headers: authHeaders(),
      });

      setForm(defaultForm());
      onCreated?.();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          `Không thể thêm máy ${typeLabel}. Vui lòng thử lại.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-modal app-modal-overlay mida-modal-overlay" onClick={handleClose}>
      <div className="app-modal-panel app-modal-panel--create mida-modal-panel" onClick={(e) => e.stopPropagation()}>
        <h5 className="app-modal-title mb-3">Thêm máy {typeLabel} mới</h5>

        <div className="mb-2">
          <label className="app-modal-label">Tên máy</label>
          <input
            type="text"
            className="form-control app-modal-input mida-modal-input"
            value={form.machine_name}
            autoComplete="off"
            onChange={(e) => setForm((prev) => ({ ...prev, machine_name: e.target.value }))}
          />
        </div>

        <div className="mb-2">
          <label className="app-modal-label">ID máy</label>
          <input
            type="text"
            className="form-control app-modal-input mida-modal-input"
            value={form.machine_id}
            autoComplete="off"
            placeholder={isEp ? 'VD: MIDA_EP_01' : 'VD: MIDA_CNC_01'}
            onChange={(e) => setForm((prev) => ({ ...prev, machine_id: e.target.value }))}
          />
        </div>

        <div className="mb-2">
          <label className="app-modal-label">Nhà máy</label>
          {isAdmin || locations.length === 0 ? (
            <input
              type="text"
              className="form-control app-modal-input mida-modal-input"
              value={form.location}
              autoComplete="off"
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            />
          ) : (
            <select
              className="form-control app-modal-input mida-modal-input"
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-3">
          <label className="app-modal-label">Hình ảnh (không bắt buộc)</label>
          <input
            type="file"
            accept="image/*"
            className="form-control app-modal-input mida-modal-input"
            onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
          />
        </div>

        {error && <p className="mida-modal-error">{error}</p>}

        <div className="d-flex justify-content-end mt-3 gap-2">
          <button type="button" className="btn app-modal-btn-outline mida-modal-btn" onClick={handleClose} disabled={submitting}>
            Hủy
          </button>
          <button
            type="button"
            className="btn app-modal-btn-primary px-4 mida-modal-btn mida-modal-btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}
