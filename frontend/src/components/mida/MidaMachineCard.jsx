import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { BASE_URL } from '../../config/config';
import { getMachineStatusLabel, isMachineConnected, isMachineRunning } from '../../utils/machineStatus';

export default function MidaMachineCard({ machine, now, machineType = 'cnc', onDelete }) {
  const placeholder = machineType === 'ep' ? 'ÉP' : 'CNC';
  const connected = isMachineConnected(machine.last_updated, now);
  const running = connected && isMachineRunning(machine.status);
  const statusLabel = !connected ? 'Mất kết nối' : getMachineStatusLabel(machine.status);
  const imageSrc = machine.image_url ? `${BASE_URL}${machine.image_url}` : null;

  return (
    <div className="mida-machine-card-wrap">
      <Link to={`/mida/cnc/${encodeURIComponent(machine.machine_id)}`} className="mida-machine-card">
        <div className="mida-machine-card__header">
          <span className={`mida-machine-card__dot ${running ? 'is-run' : connected ? 'is-stop' : 'is-offline'}`} />
          <span className="mida-machine-card__status">{statusLabel}</span>
        </div>
        <div className="mida-machine-card__body">
          {imageSrc ? (
            <img src={imageSrc} alt="" className="mida-machine-card__img" />
          ) : (
            <div className="mida-machine-card__placeholder">{placeholder}</div>
          )}
          <h3 className="mida-machine-card__name">{machine.machine_name || machine.machine_id}</h3>
          <p className="mida-machine-card__id">{machine.machine_id}</p>
        </div>
        <div className="mida-machine-card__footer">
          <span>{machine.location}</span>
          {machine.last_updated && <span>{new Date(machine.last_updated).toLocaleString('vi-VN')}</span>}
        </div>
      </Link>
      {onDelete && (
        <button
          type="button"
          className="mida-machine-card__delete"
          onClick={() => onDelete(machine)}
          aria-label={`Xoá máy ${machine.machine_name || machine.machine_id}`}
          title="Xoá máy"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
