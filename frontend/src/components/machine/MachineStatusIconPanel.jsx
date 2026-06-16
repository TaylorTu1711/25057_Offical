import { createContext, memo, useContext, useMemo } from 'react';
import MachineStatusAnimated from './MachineStatusAnimated';

const MachineStatusIconContext = createContext({
  isRunning: false,
  isConnected: false,
  title: '',
});

/** Chỉ re-render icon khi trạng thái đổi — tách khỏi poll sản lượng/biểu đồ. */
export function MachineStatusIconProvider({ isRunning, isConnected, title, children }) {
  const value = useMemo(
    () => ({ isRunning, isConnected, title }),
    [isRunning, isConnected, title],
  );
  return (
    <MachineStatusIconContext.Provider value={value}>
      {children}
    </MachineStatusIconContext.Provider>
  );
}

const MachineStatusIconPanel = () => {
  const { isRunning, isConnected, title } = useContext(MachineStatusIconContext);
  return (
    <MachineStatusAnimated
      isRunning={isRunning}
      isConnected={isConnected}
      title={title}
    />
  );
};

export default memo(MachineStatusIconPanel);
