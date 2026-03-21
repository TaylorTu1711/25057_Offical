
import { BASE_URL } from '../config/config';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveToken } from '../utils/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error('Login failed');

      const data = await res.json(); // { token: "..." }

      // ✅ Lưu token
      saveToken(data.token);

      // ✅ Giải mã token để lấy thông tin user (email, role, id)
      const decoded = JSON.parse(atob(data.token.split('.')[1]));
      console.log(decoded.role);

      // ✅ Lưu role vào localStorage (hoặc Context)
      localStorage.setItem('role', decoded.role);
      localStorage.setItem('email', decoded.email);

      // ✅ Điều hướng về trang chính
      navigate('/');
    } catch (err) {
      setError('Email hoặc mật khẩu không đúng');
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ minWidth: '350px' }}>
        <h3 className="text-center mb-4">Đăng nhập</h3>
        {error && <div className="alert alert-danger text-center">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label">Tên đăng nhập</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nhập tên đăng nhập..."
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Mật khẩu</label>
            <input
              type="password"
              className="form-control"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary w-100" type="submit">Đăng nhập</button>
        </form>
        {/* <p className="text-center mt-3">
          Chưa có tài khoản? <a href="/register">Đăng ký</a>
        </p> */}
      </div>
    </div>
  );
}
