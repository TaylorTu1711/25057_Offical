import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { logout } from '../../utils/auth';
import useTheme from '../../hooks/useTheme';
import midaLogo from '../../assets/MIDA-LOGO.png';
import '../../css/MidaCnc.css';

export default function MidaNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isHomeActive = location.pathname === '/mida/cnc';
  const homeNavClass = `mida-navbar__nav-item mida-navbar__nav-item--home${isHomeActive ? ' is-active' : ''}`;

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="mida-navbar">
      <Link to="/mida/cnc" className="mida-navbar__logo-link" aria-label="MIDA Precision Mold">
        <img src={midaLogo} alt="MIDA Precision Mold" className="mida-navbar__logo" />
      </Link>
      <h1 className="mida-navbar__title">HỆ SCADA CÁC MÁY MIDA</h1>
      <div className="mida-navbar__actions mida-navbar__actions--desktop">
        <button
          type="button"
          className="mida-navbar__icon-btn"
          onClick={toggleTheme}
          aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/mida/cnc" className={homeNavClass} aria-current={isHomeActive ? 'page' : undefined}>
          <Home size={18} strokeWidth={2} aria-hidden="true" />
          <span className="mida-navbar__nav-label">Trang chủ</span>
        </Link>
        <button type="button" className="mida-navbar__nav-item mida-navbar__nav-item--logout" onClick={handleLogout}>
          <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          <span className="mida-navbar__nav-label">Đăng xuất</span>
        </button>
      </div>
      <div className="mida-navbar__mobile-menu" ref={menuRef}>
        <button
          type="button"
          className="mida-navbar__menu-btn"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="Mở menu điều hướng"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
        {menuOpen && (
          <div className="mida-navbar__dropdown" role="menu">
            <Link
              to="/mida/cnc"
              className={`mida-navbar__dropdown-item ${homeNavClass}`}
              role="menuitem"
              aria-current={isHomeActive ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Home size={16} strokeWidth={2} aria-hidden="true" />
              <span className="mida-navbar__nav-label">Trang chủ</span>
            </Link>
            <button
              type="button"
              className="mida-navbar__dropdown-item"
              role="menuitem"
              onClick={() => {
                toggleTheme();
                setMenuOpen(false);
              }}
            >
              {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              {isDark ? 'Chế độ sáng' : 'Chế độ tối'}
            </button>
            <button
              type="button"
              className="mida-navbar__dropdown-item mida-navbar__nav-item mida-navbar__nav-item--logout"
              role="menuitem"
              onClick={handleLogout}
            >
              <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              <span className="mida-navbar__nav-label">Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
