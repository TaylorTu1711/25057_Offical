import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { saveToken, saveUserSession } from '../utils/auth';
import { BASE_URL } from '../config/config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
      const data = res.data;
      saveToken(data.token);
      saveUserSession({
        role: data.role,
        portal: data.portal,
        redirectPath: data.redirectPath,
        locations: data.locations,
      });
      localStorage.setItem('email', email);
      navigate(data.redirectPath || '/');
    } catch {
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
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Mật khẩu</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-100" type="submit">Đăng nhập</button>
        </form>
      </div>
    </div>
  );
}
