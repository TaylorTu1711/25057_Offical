/**
 * Đọc năng suất chuẩn từ ô "Thông tin khác" (mỗi dòng: "Tên: Giá trị").
 * Ví dụ: "Năng suất: 2 tấn/ giờ" → { value: 2, label: '2 tấn/giờ', unit: 'tấn/giờ' }
 */
export function parseStandardProductivity(information) {
  if (!information || typeof information !== 'string') return null;

  const lines = information.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const key = line.slice(0, colonIdx).trim();
    if (!/năng\s*suất/i.test(key)) continue;

    const valueText = line.slice(colonIdx + 1).trim();
    const numMatch = valueText.match(/([\d]+(?:[.,]\d+)?)/);
    if (!numMatch) continue;

    const value = parseFloat(numMatch[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) continue;

    const hasTon = /tấn|tan/i.test(valueText);
    const hasPerHour = /giờ|gio|\/\s*h\b/i.test(valueText);
    const label =
      hasTon && hasPerHour ? `${value} tấn/giờ` : hasTon ? `${value} tấn` : String(value);

    return {
      value,
      label,
      unit: hasTon && hasPerHour ? 'tấn/giờ' : hasTon ? 'tấn' : '',
    };
  }

  return null;
}

/**
 * Đọc ngày bàn giao từ ô "Thông tin khác" (mỗi dòng: "Tên: Giá trị").
 * Ví dụ: "Ngày bàn giao: 15/6/2026," → "15/6/2026"
 */
export function parseHandoverDate(information) {
  if (!information || typeof information !== 'string') return null;

  const lines = information.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const key = line.slice(0, colonIdx).trim();
    if (!/ngày\s*bàn\s*giao/i.test(key)) continue;

    const valueText = line.slice(colonIdx + 1).trim().replace(/,\s*$/, '');
    return valueText || null;
  }

  return null;
}
