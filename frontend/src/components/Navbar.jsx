import React, { useState, useRef, useEffect } from 'react';
import '../css/Navbar.css';
import logo from '../assets/LOGO-MO.png';
import { logout } from '../utils/auth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Home, LogOut, Moon, Sun } from 'lucide-react';
import flagVI from '../assets/flag-vi.png';
import flagEN from '../assets/flag-en.webp';
import useTheme from '../hooks/useTheme';
import {
  applyGoogleTranslation,
  clearGoogTransCookie,
  getGoogTransTargetLang,
  setGoogTransCookie,
} from '../utils/googleTranslate';
//import '../css/translate.css'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState("vi");

  const [langOpenDesktop, setLangOpenDesktop] = useState(false);
  const [langOpenMobile, setLangOpenMobile] = useState(false);

  const langRefDesktop = useRef(null);
  const langRefMobile = useRef(null);
  const lastApplyAtRef = useRef(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const toggleSidebar = () => setIsOpen(!isOpen);

  const getSavedLanguage = () => {
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang === 'vi' || savedLang === 'en') return savedLang;
    return getGoogTransTargetLang() || 'vi';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const triggerGoogleTranslation = (lng) => {
    if (lng === 'vi') return;

    const now = Date.now();
    if (now - lastApplyAtRef.current < 300) return;
    if (applyGoogleTranslation(lng)) {
      lastApplyAtRef.current = now;
    }
  };

  // 👉 Google translate
  const changeLang = (lng) => {
    if (lng !== 'vi' && lng !== 'en') return;
    if (lng === lang) {
      setLangOpenDesktop(false);
      setLangOpenMobile(false);
      return;
    }

    localStorage.setItem('app_lang', lng);

    // Tiếng Việt gốc: xóa cookie googtrans (không set /auto/vi — sẽ không hoạt động trên HTTPS).
    if (lng === 'vi') {
      clearGoogTransCookie();
    } else {
      setGoogTransCookie(lng);
    }

    setLang(lng);
    setLangOpenDesktop(false);
    setLangOpenMobile(false);
    window.location.reload();
  };

  useEffect(() => {
    setLang(getSavedLanguage());
  }, []);

  // Re-apply translation only when navigating to a machine detail page.
  useEffect(() => {
    if (lang === 'vi') return;
    if (!location.pathname.startsWith('/machines/')) return;
    const timer = setTimeout(() => triggerGoogleTranslation(lang), 200);
    return () => clearTimeout(timer);
  }, [lang, location.pathname]);

  // 👉 Click ngoài để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        langRefDesktop.current &&
        !langRefDesktop.current.contains(e.target)
      ) {
        setLangOpenDesktop(false);
      }

      if (
        langRefMobile.current &&
        !langRefMobile.current.contains(e.target)
      ) {
        setLangOpenMobile(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <nav className="navbar navbar-expand-lg shadow-sm px-4 py-0 sticky-top navbar-app">
        <div className="container-fluid d-flex justify-content-between align-items-center">

          {/* Logo */}
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <img src={logo} alt="Logo" width="200" height="200" className="me-3" />
          </Link>

          {/* Title */}
          <div className="flex-grow-1 text-center d-none d-lg-block">
            <span className="navbar-title fw-bold fs-4 navbar-brand-text">
              HỆ SCADA CÁC MÁY PLENMA
            </span>
          </div>

          {/* Desktop menu */}
          <div className="hidden lg:flex items-center gap-0">

            {/* Dark / Light mode */}
            <button
              type="button"
              onClick={toggleTheme}
              className="nav-action-btn nav-action-btn--icon ml-3"
              title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
              aria-label={isDark ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* 🌐 Language Dropdown */}
            <div ref={langRefDesktop} className="relative ml-3 px-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLangOpenDesktop(!langOpenDesktop);
                }}
                className="nav-action-btn px-0 py-0"
              >
                <img
                  src={lang === "vi" ? flagVI : flagEN}
                  alt="lang"
                  className="w-6 h-4 object-cover rounded-sm"
                />
              </button>

              {langOpenDesktop  && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-14 border rounded shadow-md z-50" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>

                  <button
                    onClick={() => changeLang("vi")}
                    className={`flex justify-center items-center w-full py-2 ${
                      lang === "vi" ? "bg-gray-200" : "hover:bg-gray-100"
                    }`}
                  >
                    <img src={flagVI} alt="vi" className="w-full h-8 object-cover" />
                  </button>

                  <button
                    onClick={() => changeLang("en")}
                    className={`flex justify-center items-center w-full py-2 ${
                      lang === "en" ? "bg-gray-200" : "hover:bg-gray-100"
                    }`}
                  >
                    <img src={flagEN} alt="en" className="w-full h-8 object-cover" />
                  </button>

                </div>
              )}
            </div>

            {/* Trang chủ */}
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-lg font-semibold rounded-lg transition-colors no-underline navbar-brand-text"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--nav-hover-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Home className="w-5 h-5" />
              Trang chủ
            </a>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-lg font-semibold rounded-lg transition-colors navbar-brand-text"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--nav-hover-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>

          </div>

          {/* Mobile button — chỉ hiện màn hình nhỏ */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="d-lg-none p-2 rounded-lg nav-action-btn nav-action-btn--icon"
            aria-label="Mở menu"
          >
            <Menu className="w-7 h-7" />
          </button>

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
              <a
                href="/"
                onClick={toggleSidebar}
                className="flex items-center gap-3 py-3 pl-2 pr-4 text-lg font-semibold navbar-brand-text no-underline"
              >
                <Home className="w-6 h-6 ml-2" />
                Trang chủ
              </a>
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

            <li className="px-4 py-3 border-t mt-2">
              <div ref={langRefMobile} className="relative">

                {/* Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLangOpenMobile(!langOpenMobile)
                  }}
                  className="nav-action-btn px-2 py-1"
                >
                  <img
                    src={lang === "vi" ? flagVI : flagEN}
                    alt="lang"
                    className="w-6 h-4 object-cover rounded-sm"
                  />
                  <span className="text-sm">Ngôn ngữ</span>
                </button>

                {/* Dropdown */}
                {langOpenMobile  && (
                  <div className="absolute left-0 mt-2 w-20 border rounded shadow-md z-50" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>

                    <button
                      onClick={() => changeLang("vi")}
                      className={`flex justify-center items-center w-full py-2 ${
                        lang === "vi" ? "bg-gray-200" : "hover:bg-gray-100"
                      }`}
                    >
                      <img src={flagVI} alt="vi" className="w-full h-6 object-cover" />
                    </button>

                    <button
                      onClick={() => changeLang("en")}
                      className={`flex justify-center items-center w-full py-2 ${
                        lang === "en" ? "bg-gray-200" : "hover:bg-gray-100"
                      }`}
                    >
                      <img src={flagEN} alt="en" className="w-full h-6 object-cover" />
                    </button>

                  </div>
                )}

              </div>
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