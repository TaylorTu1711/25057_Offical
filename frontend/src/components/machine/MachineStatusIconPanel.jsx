import React, { memo } from 'react';
import MachineStatusAnimated from './MachineStatusAnimated';

/** Tách icon trạng thái — tránh re-render khi sản lượng/biểu đồ/thời gian chạy cập nhật. */
const MachineStatusIconPanel = ({ isRunning, isConnected, title }) => (
  <MachineStatusAnimated
    isRunning={isRunning}
    isConnected={isConnected}
    title={title}
  />
);

export default memo(MachineStatusIconPanel);
