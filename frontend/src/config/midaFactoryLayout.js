/** Vị trí marker mặc định trên sơ đồ xưởng 3D (%, theo hàng máy chính). */
function buildFactorySlots() {
  const rows = [
    // Hàng trên cùng (sát tường bắc)
    { top: 22, lefts: [34, 43, 52, 61, 70, 79, 88] },
    // Hàng 2
    { top: 36, lefts: [32, 40, 48, 56, 64, 72, 80, 88] },
    // Hàng 3
    { top: 50, lefts: [34, 43, 52, 61, 70, 79, 88] },
    // Hàng 4
    { top: 64, lefts: [32, 40, 48, 56, 64, 72, 80, 88] },
    // Hàng dưới (4 máy lớn hơn, giãn cách)
    { top: 82, lefts: [40, 54, 68, 84] },
    // Khu sàn xanh (trái)
    { top: null, lefts: [14, 14, 14, 14], tops: [38, 50, 62, 74] },
    // 2 máy gần phòng server
    { top: 30, lefts: [24, 30] },
  ];

  const slots = [];
  for (const row of rows) {
    if (row.tops) {
      row.lefts.forEach((left, i) => {
        slots.push({ left, top: row.tops[i] });
      });
    } else {
      row.lefts.forEach((left) => {
        slots.push({ left, top: row.top });
      });
    }
  }
  return slots;
}

export const MIDA_FACTORY_SLOTS = buildFactorySlots();

export const MIDA_FACTORY_MAX_SLOTS = MIDA_FACTORY_SLOTS.length;
