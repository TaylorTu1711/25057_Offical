import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// Middleware xác thực JWT
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Kiểm tra có header Authorization hay không
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Lấy token ra từ header
    const token = authHeader.split(' ')[1];

    // 3️⃣ (Tùy chọn) Kiểm tra token có bị thu hồi không — placeholder
    // if (await isTokenBlacklisted(token)) {
    //   return res.status(401).json({ error: 'Token has been revoked' });
    // }

    // 4️⃣ Giải mã và xác minh token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 5️⃣ Gán thông tin user vào request để các route khác có thể dùng
    req.user = decoded; // { id, email, role }

    next();
  } catch (err) {
    // Token hết hạn hoặc không hợp lệ
    console.error('JWT verify error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
};




