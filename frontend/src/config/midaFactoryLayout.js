/** Vị trí marker trên sơ đồ nhà máy (%, theo ảnh 3 cột × 7 hàng). */
function buildFactorySlots() {
  const colLeftBack = [15.5, 37.5, 59.5];
  const colLeftFront = [10.5, 32.5, 54.5];
  const colTopBack = [17, 14, 11];
  const colTopFront = [57, 54, 51];
  const rows = 7;
  const slots = [];

  for (let col = 0; col < 3; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const t = row / (rows - 1);
      slots.push({
        left: colLeftBack[col] + (colLeftFront[col] - colLeftBack[col]) * t,
        top: colTopBack[col] + (colTopFront[col] - colTopBack[col]) * t,
      });
    }
  }

  return slots;
}

export const MIDA_FACTORY_SLOTS = buildFactorySlots();

export const MIDA_FACTORY_MAX_SLOTS = MIDA_FACTORY_SLOTS.length;
