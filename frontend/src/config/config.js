/** Rỗng = cùng origin (HTTPS), tránh Mixed Content khi deploy production. */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
