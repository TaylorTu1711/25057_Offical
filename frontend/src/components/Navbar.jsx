import React, { useState } from 'react';
import '../css/Navbar.css';
import logo from '../assets/LOGO-MO.png';
import { getPortal, getPostLoginPath, getRole, logout } from '../utils/auth';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Home, LogOut, Moon, Sun } from 'lucide-react';
import useTheme from '../hooks/useTheme';

const Navbar = ({ title = 'HỆ SCADA CÁC MÁY PLENMA', extraActions = null }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const toggleSidebar = () => setIsOpen(!isOpen);
  const homePath = getPostLoginPath(getPortal(), getRole()) || '/';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goHome = (event) => {
    if (event) event.preventDefault();
    setIsOpen(false);
    navigate(homePath);
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg shadow-sm px-4 py-0 sticky-top navbar-app">
        <div className="container-fluid d-flex justify-content-between align-items-center">

          {/* Logo */}
          <Link className="navbar-brand d-flex align-items-center" to={homePath}>
            <img src={logo} alt="Logo" width="200" height="200" className="me-3" />
          </Link>

          {/* Title */}
          <div className="flex-grow-1 text-center d-none d-lg-block">
            <span className="navbar-title fw-bold fs-4 navbar-brand-text">
              {title}
            </span>
          </div>

          {/* Desktop menu — khoảng cách đều giữa các nút */}
          <div className="navbar-actions hidden lg:flex">
            {extraActions ? (
              <div className="navbar-actions__item">{extraActions}</div>
            ) : null}

            <button
              type="button"
              onClick={toggleTheme}
              className="nav-action-btn nav-action-btn--icon navbar-actions__item"
              title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
              aria-label={isDark ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <Link
              to={homePath}
              className="navbar-actions__link navbar-actions__item no-underline navbar-brand-text"
            >
              <Home className="w-5 h-5" />
              Trang chủ
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="navbar-actions__link navbar-actions__item navbar-brand-text"
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </div>

          {/* Mobile: nút phụ + menu */}
          <div className="d-lg-none d-flex align-items-center gap-2">
            {extraActions}
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 rounded-lg nav-action-btn nav-action-btn--icon"
              aria-label="Mở menu"
            >
              <Menu className="w-7 h-7" />
            </button>
          </div>

        </div>
      </nav>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 d-lg-none"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-80 shadow-2xl z-50 transform transition-transform duration-300 d-lg-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--app-surface)' }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center h-20 px-6 border-b"
          style={{ background: 'var(--nav-hover-bg)', borderColor: 'var(--app-border)' }}
        >
          <h2 className="text-xl font-bold navbar-brand-text">Menu</h2>
          <button type="button" onClick={toggleSidebar} className="nav-action-btn nav-action-btn--icon">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div>
          <ul className="list-none m-0 p-0">
            <li>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                }}
                className="flex items-center gap-3 w-full py-3 pl-2 pr-4 text-lg font-semibold navbar-brand-text"
                style={{ backgroundColor: 'transparent' }}
              >
                {isDark ? <Sun className="w-6 h-6 ml-2" /> : <Moon className="w-6 h-6 ml-2" />}
                {isDark ? 'Chế độ sáng' : 'Chế độ tối'}
              </button>
            </li>

            <li>
              <button
                type="button"
                onClick={goHome}
                className="flex items-center gap-3 w-full py-3 pl-2 pr-4 text-lg font-semibold navbar-brand-text"
                style={{ backgroundColor: 'transparent', border: 0 }}
              >
                <Home className="w-6 h-6 ml-2" />
                Trang chủ
              </button>
            </li>

            <li>
              <button
                onClick={() => {
                  handleLogout();
                  toggleSidebar();
                }}
                className="flex items-center gap-3 w-full py-3 pl-2 pr-4 text-lg font-semibold navbar-brand-text"
                style={{ backgroundColor: 'transparent' }}
              >
                <LogOut className="w-6 h-6 ml-2" />
                Đăng xuất
              </button>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 w-full p-6 border-t" style={{ backgroundColor: 'var(--app-surface-muted)', borderColor: 'var(--app-border)' }}>
          <p className="font-semibold navbar-brand-text">Plenma System</p>
          <p className="text-sm text-muted">Version 1.0</p>
        </div>
      </div>
    </>
  );
};

export default Navbar;
