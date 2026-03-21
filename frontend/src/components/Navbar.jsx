import React, { useState } from 'react';
import '../css/Navbar.css';
import logo from '../assets/LOGO-MO.png';
import { logout } from '../utils/auth';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Home, LogOut } from 'lucide-react';




const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
    <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm px-4 py-2 sticky-top">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        {/* Logo bên trái */}
        <Link className="navbar-brand d-flex align-items-center" to="/">
          <img src={logo} alt="Logo" width="200" height="200" className="me-3" />
        </Link>

        {/* Tiêu đề ở giữa */}
        <div className="flex-grow-1 text-center d-none d-lg-block">
          <span
            className="navbar-title fw-bold fs-4"
            style={{ color: 'rgba(32, 64, 154, 1)' }}
          >
            HỆ SCADA CÁC MÁY PLENMA
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-0">
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2 text-lg font-semibold rounded-lg transition-colors hover:bg-blue-50 no-underline"
            style={{ color: 'rgba(32, 64, 154, 1)' }}
          >
            <Home className="w-5 h-5" />
            Trang chủ
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-lg font-semibold rounded-lg transition-colors hover:bg-red-50 no-underline"
            style={{ color: 'rgba(32, 64, 154, 1)' }}
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>           
        </div>

          {/* Nút hamburger - Chỉ hiển thị trên mobile */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-7 h-7" style={{ color: 'rgba(32, 64, 154, 1)' }} />
          </button>         
      </div>
    </nav>

    {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        ></div>
      )}

    <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header của sidebar */}
      <div className="flex justify-between items-center h-20 px-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
        <h2 className="text-xl font-bold text-[#20409A]">Menu</h2>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-white transition-colors"
          aria-label="Close menu"
        >
          <X className="w-6 h-6 text-[#20409A]" />
        </button>
      </div>

        {/* Nội dung sidebar */}
        <div className="p-0 m-0">
          <ul className="space-y-0 list-none m-0 p-0">
            <li className="m-0 p-0">
              <a
                href="/"
                onClick={toggleSidebar}
                className="flex items-center gap-3 w-full py-3 pl-2 pr-4 text-lg font-semibold rounded-none transition-all hover:bg-blue-50 no-underline"
                style={{ color: 'rgba(32, 64, 154, 1)' }}
              >
                <Home className="w-6 h-6 ml-2" />
                <span>Trang chủ</span>
              </a>
            </li>
            <li className="m-0 p-0">
              <button
                onClick={() => {
                  handleLogout();
                  toggleSidebar();
                }}
                className="flex items-center gap-3 w-full py-3 pl-2 pr-4 text-lg font-semibold rounded-none transition-all hover:bg-red-50 hover:text-red-600"
                style={{ color: 'rgba(32, 64, 154, 1)' }}
              >
                <LogOut className="w-6 h-6 ml-2" />
                <span>Đăng xuất</span>
              </button>
            </li>
          </ul>
        </div>



        {/* Footer sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div>
              <p className="font-semibold text-gray-800">Plenma System</p>
              <p className="text-sm text-gray-600">Version 1.0</p>
            </div>
          </div>
        </div>
      </div>

  </>
  );
};

export default Navbar;
