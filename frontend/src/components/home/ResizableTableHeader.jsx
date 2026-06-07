import React from 'react';

const ResizableTableHeader = ({
  columnKey,
  width,
  label,
  className = '',
  onResizeStart,
  isResizing,
  resizable = true,
  style = {},
}) => (
  <th
    className={`resizable-table-th ${className}`.trim()}
    style={{ width, ...style }}
  >
    <span className="resizable-table-th__label">{label}</span>
    {resizable && onResizeStart && (
      <div
        className={`resizable-table-col-resizer${isResizing ? ' resizable-table-col-resizer--active' : ''}`}
        onMouseDown={(event) => onResizeStart(columnKey, event)}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Kéo để thay đổi độ rộng cột ${label}`}
        title="Kéo để thay đổi độ rộng cột"
      />
    )}
  </th>
);

export default ResizableTableHeader;
