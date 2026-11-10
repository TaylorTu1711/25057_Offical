import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { BASE_URL } from '../../config/config';
import { authHeaders, logout } from '../../utils/auth';
import { buildDtrPublicPath, buildDtrTailscaleUrl } from '../../utils/dtrSortMachine';
import '../../css/DtrSortMachine.css';

/**
 * Fallback khi vào /dtr/sortmachine/:id bằng React Router (SPA).
 * Production/dev có proxy: full navigation tới path này sẽ do Express gateway phục vụ.
 * Nếu vẫn vào được trang này → chuyển full-page sang path có trailing slash để hit proxy.
 */
export default function SortMachineDetailPage() {
  const { machine_id } = useParams();
  const navigate = useNavigate();
  const [machine, setMachine] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(
          `${BASE_URL}/api/portal/dtr/sort-machines/${encodeURIComponent(machine_id)}`,
          { headers: authHeaders() },
        );
        if (!cancelled) setMachine(res.data?.machine || null);
      } catch (err) {
        if (!cancelled) {
          setMachine(null);
          setError(err.response?.data?.error || 'Không tải được máy');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machine_id]);

  useEffect(() => {
    if (!machine?.machine_id) return undefined;
    const publicPath = buildDtrPublicPath(machine.machine_id);
    // Full reload để Vite/Nginx chuyển request sang Express gateway
    const timer = window.setTimeout(() => {
      window.location.replace(publicPath);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [machine]);

  const publicPath = machine ? buildDtrPublicPath(machine.machine_id) : '';
  const tailscaleUrl = machine ? buildDtrTailscaleUrl(machine) : '';

  return (
    <div className="dtr-page">
      <header className="dtr-page__header">
        <div>
          <p className="dtr-page__eyebrow">DTR Sort Machine</p>
          <h1 className="dtr-page__title">{machine?.name || machine_id}</h1>
          <p className="dtr-page__sub">
            Đang mở qua domain: <code>{publicPath || `/dtr/sortmachine/${machine_id}/`}</code>
          </p>
        </div>
        <div className="dtr-page__header-actions">
          <Link className="btn btn-sm btn-outline-secondary" to="/dtr/sortmachine">
            ← Danh sách
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {loading ? <p className="text-muted">Đang tải máy…</p> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      {machine ? (
        <div className="card shadow-sm border-0 dtr-detail">
          <div className="card-body">
            <p className="mb-2">
              Client không cần Tailscale. Server sẽ proxy tới máy nội bộ.
            </p>
            <p className="mb-3">
              <a className="btn btn-primary" href={publicPath}>
                Mở {publicPath}
              </a>
            </p>
            <p className="small text-muted mb-0">
              Upstream nội bộ (chỉ server dùng): <code>{tailscaleUrl}</code>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
