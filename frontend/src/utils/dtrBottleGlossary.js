/** Danh mục ký hiệu loại chai mặc định (biểu đồ thống kê số chai). */
export const DTR_BOTTLE_GLOSSARY_KEYS = [
  { key: 'b1_kn', label: 'B1_KN', meaning: 'B1 Không nhãn' },
  { key: 'b1_nl', label: 'B1_NL', meaning: 'B1 Nhãn lớn' },
  { key: 'b1_nn', label: 'B1_NN', meaning: 'B1 Nhãn nhỏ' },
  { key: 'b1_oh', label: 'B1_OH', meaning: 'B1 ống hút' },
  { key: 'b4_kn', label: 'B4_KN', meaning: 'B4 Không nhãn' },
  { key: 'b4_nl', label: 'B4_NL', meaning: 'B4 Nhãn lớn' },
  { key: 'b4_nn', label: 'B4_NN', meaning: 'B4 nhãn nhỏ' },
  { key: 'b4_oh', label: 'B4_OH', meaning: 'B4 Ống hút' },
  { key: 'b5_kn', label: 'B5_KN', meaning: 'B5 Không nhãn' },
  { key: 'b5_nl', label: 'B5_NL', meaning: 'B5 Nhãn lớn' },
  { key: 'b5_nn', label: 'B5_NN', meaning: 'B5 nhãn nhỏ' },
  { key: 'hu_kn', label: 'HU_KN', meaning: 'Hũ không nhãn' },
  { key: 'hu_nl', label: 'HU_NL', meaning: 'Hũ nhãn lớn' },
  { key: 'no_classify', label: 'NO_CLASSIFY', meaning: 'Chai mới/Chưa nhận dạng được' },
];

export function defaultBottleGlossaryMap() {
  const out = {};
  for (const item of DTR_BOTTLE_GLOSSARY_KEYS) {
    out[item.key] = item.meaning;
  }
  return out;
}

/** Gộp bản lưu DB với mặc định → list { key, label, meaning }. */
export function resolveBottleGlossary(stored) {
  const defaults = defaultBottleGlossaryMap();
  const src =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  return DTR_BOTTLE_GLOSSARY_KEYS.map((item) => {
    const raw = src[item.key] ?? src[item.label] ?? src[String(item.key).toUpperCase()];
    const meaning = String(raw ?? defaults[item.key] ?? item.meaning).trim() || item.meaning;
    return { ...item, meaning };
  });
}

/** Map key → meaning để gửi API. */
export function bottleGlossaryToMap(listOrMap) {
  if (listOrMap && typeof listOrMap === 'object' && !Array.isArray(listOrMap)) {
    const out = {};
    for (const item of DTR_BOTTLE_GLOSSARY_KEYS) {
      const raw = listOrMap[item.key];
      out[item.key] = String(raw ?? item.meaning).trim() || item.meaning;
    }
    return out;
  }
  const out = defaultBottleGlossaryMap();
  if (Array.isArray(listOrMap)) {
    for (const row of listOrMap) {
      const key = String(row?.key || '').toLowerCase();
      if (!key || !(key in out)) continue;
      const meaning = String(row?.meaning ?? '').trim();
      if (meaning) out[key] = meaning;
    }
  }
  return out;
}
