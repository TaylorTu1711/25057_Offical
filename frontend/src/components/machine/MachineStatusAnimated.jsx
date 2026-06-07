import React from 'react';
import ThreeGears from './ThreeGears';

const MachineStatusAnimated = ({ isRunning, isConnected, title }) => (
  <div
    className={`machine-status-animated${
      isRunning ? ' machine-status-animated--running' : ' machine-status-animated--stopped'
    }${isConnected ? '' : ' machine-status-animated--offline'}`}
    title={title}
    role="img"
    aria-label={title}
  >
    <ThreeGears isRunning={isRunning} />
  </div>
);

export default MachineStatusAnimated;
