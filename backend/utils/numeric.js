/**
 * Chuẩn hóa shoot từ PLC — nhận integer, real hoặc chuỗi số.
 * @returns {number|null}
 */
export function parseShoot(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) return null;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
