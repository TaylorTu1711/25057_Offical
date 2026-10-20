/** Có khai báo thành phẩm / nguyên liệu đầu vào (tên + đơn vị). */
export function hasInputProductInfo(machineInfo) {
  if (!machineInfo) return false;
  const name = String(machineInfo.input_name ?? '').trim();
  const unit = String(machineInfo.input_unit ?? '').trim();
  return Boolean(name && unit);
}

/** Có khai báo thành phẩm đầu ra (tên + đơn vị). */
export function hasOutputProductInfo(machineInfo) {
  if (!machineInfo) return false;
  const name = String(machineInfo.output_name ?? '').trim();
  const unit = String(machineInfo.output_unit ?? '').trim();
  return Boolean(name && unit);
}

