import React, { useCallback, useEffect, useRef } from 'react';

const AutoFitMachineName = ({
  text,
  maxFontSize = 24,
  minFontSize = 11,
  className = '',
  style = {},
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  const fitText = useCallback(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    let size = maxFontSize;
    el.style.fontSize = `${size}px`;

    while (
      size > minFontSize
      && (el.scrollHeight > container.clientHeight || el.scrollWidth > container.clientWidth)
    ) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, [maxFontSize, minFontSize]);

  useEffect(() => {
    fitText();
  }, [text, fitText]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => fitText());
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitText]);

  return (
    <div
      ref={containerRef}
      className={`auto-fit-machine-name ${className}`.trim()}
      style={style}
    >
      <div ref={textRef} className="auto-fit-machine-name__text">
        {text || 'N/A'}
      </div>
    </div>
  );
};

export default AutoFitMachineName;
