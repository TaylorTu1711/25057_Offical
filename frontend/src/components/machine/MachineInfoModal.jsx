import React from 'react';

export default function MachineInfoModal({
  open,
  machineInfo,
  isConnected,
  onClose,
  onBoot,
}) {
  if (!open) return null;

  const connected = isConnected(machineInfo.last_updated);

  return (
    <div className="app-modal app-modal-overlay" onClick={onClose}>
      <div
        className="app-modal-panel app-modal-panel--md"
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
            <div className="app-modal-label">Thông tin khác:</div>
            <div className="app-modal-info-box">
              <table className="table table-sm table-bordered mb-0">
                <tbody>
                  {machineInfo.information
                    ?.split('\n')
                    .filter((line) => line.trim())
                    .map((line, index) => {
                      const [key, value] = line.split(':');
                      return (
                        <tr key={index}>
                          <td className="fw-semibold" style={{ width: '40%' }}>
                            {key?.trim()}
                          </td>
                          <td>{value?.trim()}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end mt-4 gap-2 flex-wrap">
          <button type="button" className="btn app-modal-btn-primary px-3" onClick={onBoot}>
            Boot
          </button>
          <button type="button" className="btn btn-secondary px-4" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
