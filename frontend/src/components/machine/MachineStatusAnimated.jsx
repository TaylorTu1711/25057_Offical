import React from 'react';

/** Khung đủ piston → chân máy; meet để không cắt mép trên */
const STATUS_VIEWBOX = '18 48 184 156';
const STATUS_ASPECT = 'xMidYMid meet';

const MachineStatusRunningSvg = () => (
  <svg
    viewBox={STATUS_VIEWBOX}
    preserveAspectRatio={STATUS_ASPECT}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <g className="machine-status-animated__piston-rod">
      <rect x="56" y="50" width="18" height="38" rx="3" fill="#555" stroke="#777" strokeWidth="0.5" />
      <rect x="52" y="50" width="26" height="7" rx="2" fill="#777" />
    </g>

    <rect x="28" y="82" width="164" height="94" rx="7" fill="#2e2e2e" stroke="#444" strokeWidth="0.5" />
    <rect x="42" y="96" width="136" height="64" rx="5" fill="#252525" stroke="#3a3a3a" strokeWidth="0.5" />

    <g className="machine-status-animated__gear-b">
      <circle cx="88" cy="116" r="18" fill="none" stroke="#1a7a5e" strokeWidth="3" opacity="0.9" />
      <circle cx="88" cy="116" r="11" fill="#1d5e4a" stroke="#1d9e75" strokeWidth="1.2" />
      <circle cx="88" cy="116" r="4" fill="#0d4033" />
      <g stroke="#1a7a5e" strokeWidth="3" strokeLinecap="round">
        <line x1="88" y1="96" x2="88" y2="100" />
        <line x1="88" y1="132" x2="88" y2="136" />
        <line x1="68" y1="116" x2="72" y2="116" />
        <line x1="104" y1="116" x2="108" y2="116" />
        <line x1="75" y1="103" x2="78" y2="106" />
        <line x1="98" y1="126" x2="101" y2="129" />
        <line x1="101" y1="103" x2="98" y2="106" />
        <line x1="75" y1="126" x2="78" y2="123" />
      </g>
      <g stroke="#1d9e75" strokeWidth="1.5">
        <line x1="88" y1="105" x2="88" y2="127" />
        <line x1="77" y1="110" x2="99" y2="122" />
        <line x1="99" y1="110" x2="77" y2="122" />
      </g>
    </g>

    <g className="machine-status-animated__gear-a">
      <circle cx="138" cy="128" r="30" fill="none" stroke="#5a3fcc" strokeWidth="3" opacity="0.9" />
      <circle cx="138" cy="128" r="20" fill="#3a2e8a" stroke="#7f6eee" strokeWidth="1.2" />
      <circle cx="138" cy="128" r="6" fill="#261d6a" />
      <g stroke="#5a3fcc" strokeWidth="3" strokeLinecap="round">
        <line x1="138" y1="96" x2="138" y2="102" />
        <line x1="138" y1="154" x2="138" y2="160" />
        <line x1="106" y1="128" x2="112" y2="128" />
        <line x1="164" y1="128" x2="170" y2="128" />
        <line x1="116" y1="106" x2="120" y2="111" />
        <line x1="156" y1="145" x2="160" y2="150" />
        <line x1="160" y1="106" x2="156" y2="111" />
        <line x1="116" y1="145" x2="120" y2="140" />
      </g>
      <g stroke="#7f6eee" strokeWidth="1.5">
        <line x1="138" y1="108" x2="138" y2="148" />
        <line x1="120" y1="118" x2="156" y2="138" />
        <line x1="156" y1="118" x2="120" y2="138" />
      </g>
    </g>

    <circle cx="58" cy="166" r="5" fill="#2a4a18" />
    <circle className="machine-status-animated__light-pulse" cx="58" cy="166" r="9" fill="#7ec850" opacity="0.4" />
    <circle cx="58" cy="166" r="5" fill="#7ec850" />

    <rect x="70" y="163" width="34" height="4" rx="2" fill="#7ec850" opacity="0.85" />
    <rect x="70" y="170" width="22" height="3" rx="2" fill="#1d9e75" opacity="0.6" />

    <rect x="18" y="174" width="184" height="12" rx="4" fill="#3a3a3a" stroke="#555" strokeWidth="0.5" />
    <rect x="46" y="184" width="18" height="18" rx="2" fill="#333" />
    <rect x="156" y="184" width="18" height="18" rx="2" fill="#333" />
  </svg>
);

const MachineStatusStoppedSvg = () => (
  <svg
    viewBox={STATUS_VIEWBOX}
    preserveAspectRatio={STATUS_ASPECT}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <g opacity="0.45">
      <rect x="56" y="50" width="18" height="38" rx="3" fill="#555" stroke="#666" strokeWidth="0.5" />
      <rect x="52" y="50" width="26" height="7" rx="2" fill="#666" />
    </g>

    <rect x="28" y="82" width="164" height="94" rx="7" fill="#252525" stroke="#333" strokeWidth="0.5" />
    <rect x="42" y="96" width="136" height="64" rx="5" fill="#1e1e1e" stroke="#2e2e2e" strokeWidth="0.5" />

    <g opacity="0.35">
      <circle cx="88" cy="116" r="18" fill="none" stroke="#555" strokeWidth="3" />
      <circle cx="88" cy="116" r="11" fill="#333" stroke="#555" strokeWidth="1.2" />
      <circle cx="88" cy="116" r="4" fill="#222" />
      <g stroke="#555" strokeWidth="3" strokeLinecap="round">
        <line x1="88" y1="96" x2="88" y2="100" />
        <line x1="88" y1="132" x2="88" y2="136" />
        <line x1="68" y1="116" x2="72" y2="116" />
        <line x1="104" y1="116" x2="108" y2="116" />
        <line x1="75" y1="103" x2="78" y2="106" />
        <line x1="98" y1="126" x2="101" y2="129" />
        <line x1="101" y1="103" x2="98" y2="106" />
        <line x1="75" y1="126" x2="78" y2="123" />
      </g>
      <g stroke="#444" strokeWidth="1.5">
        <line x1="88" y1="105" x2="88" y2="127" />
        <line x1="77" y1="110" x2="99" y2="122" />
        <line x1="99" y1="110" x2="77" y2="122" />
      </g>
    </g>

    <g opacity="0.35">
      <circle cx="138" cy="128" r="30" fill="none" stroke="#555" strokeWidth="3" />
      <circle cx="138" cy="128" r="20" fill="#333" stroke="#555" strokeWidth="1.2" />
      <circle cx="138" cy="128" r="6" fill="#222" />
      <g stroke="#555" strokeWidth="3" strokeLinecap="round">
        <line x1="138" y1="96" x2="138" y2="102" />
        <line x1="138" y1="154" x2="138" y2="160" />
        <line x1="106" y1="128" x2="112" y2="128" />
        <line x1="164" y1="128" x2="170" y2="128" />
        <line x1="116" y1="106" x2="120" y2="111" />
        <line x1="156" y1="145" x2="160" y2="150" />
        <line x1="160" y1="106" x2="156" y2="111" />
        <line x1="116" y1="145" x2="120" y2="140" />
      </g>
      <g stroke="#444" strokeWidth="1.5">
        <line x1="138" y1="108" x2="138" y2="148" />
        <line x1="120" y1="118" x2="156" y2="138" />
        <line x1="156" y1="118" x2="120" y2="138" />
      </g>
    </g>

    <circle cx="58" cy="166" r="5" fill="#4a1a1a" />
    <circle className="machine-status-animated__light-blink" cx="58" cy="166" r="5" fill="#e05050" />

    <rect x="70" y="163" width="34" height="4" rx="2" fill="#555" opacity="0.3" />
    <rect x="70" y="170" width="22" height="3" rx="2" fill="#444" opacity="0.3" />

    <rect x="18" y="174" width="184" height="12" rx="4" fill="#2e2e2e" stroke="#444" strokeWidth="0.5" />
    <rect x="46" y="184" width="18" height="18" rx="2" fill="#282828" />
    <rect x="156" y="184" width="18" height="18" rx="2" fill="#282828" />
  </svg>
);

const MachineStatusAnimated = ({ isRunning, isConnected, title }) => (
  <div
    className={`machine-status-animated${
      isRunning ? ' machine-status-animated--running' : ' machine-status-animated--stopped'
    }${isConnected ? '' : ' machine-status-animated--offline'}`}
    title={title}
    role="img"
    aria-label={title}
  >
    {isRunning ? <MachineStatusRunningSvg /> : <MachineStatusStoppedSvg />}
  </div>
);

export default MachineStatusAnimated;
