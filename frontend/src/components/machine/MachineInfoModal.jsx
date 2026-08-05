import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

function parseInfoLines(information) {
  if (!information || typeof information !== 'string') return [];
  return information
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { key: line.trim(), value: '' };
      return {
        key: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    });
}

export default function MachineInfoModal({
  open,
  machineInfo,
  isConnected,
  onClose,
  onBoot,
  onDelete,
  deleting = false,
  onSaveInformation,
  savingInformation = false,
  overlayClassName = '',
  panelClassName = '',
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setSaveError('');
      return;
    }
    setDraftName(machineInfo?.machine_name ?? '');
    setDraft(machineInfo?.information ?? '');
    setEditing(false);
    setSaveError('');
  }, [open, machineInfo?.information, machineInfo?.machine_name, machineInfo?.machine_id]);

  if (!open) return null;

  const connected = isConnected(machineInfo.last_updated);
  const canEdit = typeof onSaveInformation === 'function';
  const rows = parseInfoLines(machineInfo?.information);

  const handleSave = async () => {
    if (!canEdit || savingInformation) return;
    const name = String(draftName || '').trim();
    if (!name) {
      setSaveError('Tên máy không được để trống');
      return;
    }
    setSaveError('');
    try {
      await onSaveInformation({ machine_name: name, information: draft });
      setEditing(false);
    } catch (err) {
      setSaveError(
        err.response?.data?.error
          || err.response?.data?.message
          || err.message
          || 'Không thể lưu thông tin máy',
      );
    }
  };

  const handleCancelEdit = () => {
    setDraftName(machineInfo?.machine_name ?? '');
    setDraft(machineInfo?.information ?? '');
    setSaveError('');
    setEditing(false);
  };

  return (
    <div
      className={`app-modal app-modal-overlay ${overlayClassName}`.trim()}
      onClick={onClose}
    >
      <div
        className={`app-modal-panel app-modal-panel--md ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="app-modal-title">Thông tin máy</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng" />
        </div>

        <hr />

        <div className="mt-1">
          <div className="mb-3">
            <div className="app-modal-label">ID máy:</div>
            <div className="app-modal-field">{machineInfo.machine_id}</div>
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
              <div className="app-modal-label mb-0">Tên máy:</div>
              {canEdit && !editing && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Sửa
                </button>
              )}
            </div>
            {editing ? (
              <input
                type="text"
                className="form-control app-modal-input"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Nhập tên máy"
                disabled={savingInformation}
                maxLength={120}
              />
            ) : (
              <div className="app-modal-field">{machineInfo.machine_name || '—'}</div>
            )}
          </div>

          <div className="mb-3">
            <div className="app-modal-label">Trạng thái kết nối Wifi:</div>
            <div
              className={`app-modal-status ${
                connected ? 'app-modal-status--connected' : 'app-modal-status--disconnected'
              }`}
            >
              {connected ? '🟢 Đang kết nối' : '🔴 Mất kết nối'}
            </div>
          </div>

          <div>
            <div className="app-modal-label mb-1">Thông tin khác:</div>

            {editing ? (
              <>
                <textarea
                  className="form-control app-modal-input"
                  rows={8}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={'Mỗi dòng một mục, ví dụ:\nModel: XXX\nCông suất: 10kW'}
                  disabled={savingInformation}
                />
                <div className="form-text mt-1">
                  Mỗi dòng dạng <code>Tên: Giá trị</code> để hiển thị đúng bảng.
                </div>
                {saveError ? (
                  <div className="text-danger small mt-2">{saveError}</div>
                ) : null}
                <div className="d-flex justify-content-end gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary px-3"
                    onClick={handleCancelEdit}
                    disabled={savingInformation}
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="btn app-modal-btn-primary px-3"
                    onClick={handleSave}
                    disabled={savingInformation}
                  >
                    {savingInformation ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </>
            ) : (
              <div className="app-modal-info-box">
                {rows.length === 0 ? (
                  <div className="text-muted small px-2 py-2">Chưa có thông tin khác.</div>
                ) : (
                  <table className="table table-sm table-bordered mb-0">
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${row.key}-${index}`}>
                          <td className="fw-semibold" style={{ width: '40%' }}>
                            {row.key}
                          </td>
                          <td>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-4 gap-2 flex-wrap">
          {typeof onDelete === 'function' ? (
            <button
              type="button"
              className="btn btn-outline-danger px-3 d-inline-flex align-items-center gap-2"
              onClick={onDelete}
              disabled={deleting || savingInformation}
              aria-label="Xoá máy"
            >
              <Trash2 size={16} aria-hidden="true" />
              {deleting ? 'Đang xoá...' : 'Xoá máy'}
            </button>
          ) : (
            <span />
          )}
          <div className="d-flex gap-2 flex-wrap ms-auto">
            {typeof onBoot === 'function' ? (
              <button
                type="button"
                className="btn app-modal-btn-primary px-3"
                onClick={onBoot}
                disabled={savingInformation}
              >
                Boot
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary px-4" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
