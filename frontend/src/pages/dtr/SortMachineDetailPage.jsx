import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { buildDtrPublicPath } from '../../utils/dtrSortMachine';

/**
 * Nếu SPA bắt /dtr/sortmachine/:id → hard redirect sang /dashboard
 * (tránh MIME lỗi khi RR nuốt path thay vì Express shell).
 */
export default function SortMachineDetailPage() {
  const { machine_id } = useParams();

  useEffect(() => {
    const target = buildDtrPublicPath(machine_id);
    window.location.replace(target);
  }, [machine_id]);

  return (
    <div className="dtr-page p-4">
      <p className="text-muted mb-0">
        Đang mở <code>{buildDtrPublicPath(machine_id)}</code>…
      </p>
    </div>
  );
}
