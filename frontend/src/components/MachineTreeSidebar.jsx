import React, { useState } from 'react';
import '../css/MachineTree.css';
import useTreeSidebarResize from '../hooks/useTreeSidebarResize';

const TreeNode = ({ node, level = 0, onMachineClick, selectedMachineId }) => {
  const hasChildren = node.children && node.children.length > 0;
  const [manualExpand, setManualExpand] = useState(null);

  const containsSelectedMachine = (item) => {
    if (item.machine_id === selectedMachineId) return true;
    if (item.children) {
      return item.children.some((child) => containsSelectedMachine(child));
    }
    return false;
  };

  const shouldExpand = manualExpand !== null ? manualExpand : containsSelectedMachine(node);

  const toggleExpand = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      setManualExpand(!shouldExpand);
    }
  };

  const handleClick = () => {
    if (node.machine_id) onMachineClick(node.machine_id);
  };

  const isActive = node.machine_id && selectedMachineId === node.machine_id;
  const weightClass =
    level === 0 ? 'tree-item--weight-0' : level === 1 ? 'tree-item--weight-1' : 'tree-item--weight-2';

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${weightClass} ${isActive ? 'tree-item--active' : ''} ${
          !node.machine_id && !hasChildren ? 'tree-item--default-cursor' : ''
        }`}
        onClick={node.machine_id ? handleClick : toggleExpand}
      >
        {hasChildren ? (
          <i
            className={`bi bi-chevron-${shouldExpand ? 'down' : 'right'} tree-item__chevron ${
              level === 0 ? 'tree-item__chevron--level0' : ''
            }`}
            onClick={toggleExpand}
          />
        ) : (
          level > 0 && <span className="tree-item__chevron-spacer" />
        )}

        <i
          className={`bi ${node.icon || 'bi-circle'} tree-item__icon ${
            level === 0 ? 'tree-item__icon--level0' : level === 1 ? 'tree-item__icon--level1' : 'tree-item__icon--muted'
          }`}
        />
        <span
          className={`tree-item__label ${level === 0 ? 'tree-item__label--level0' : ''}`}
          title={node.label}
        >
          {node.label}
        </span>
      </div>

      {hasChildren && shouldExpand && (
        <div className="tree-children">
          {node.children.map((child, index) => (
            <React.Fragment key={index}>
              <TreeNode
                node={child}
                level={level + 1}
                onMachineClick={onMachineClick}
                selectedMachineId={selectedMachineId}
              />
              {index < node.children.length - 1 && level >= 1 && <div className="tree-child-divider" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const MachineTreeSidebar = ({
  machines = [],
  navigate,
  width,
  selectedMachineId,
  duyTanLocations = [],
  otherLocations = [],
}) => {
  const buildTreeData = () => {
    if (!machines || machines.length === 0) return [];

    const tree = [];

    const uniqueByLocation = (arr) => {
      const seen = new Set();
      return arr.filter((item) => {
        const loc = item.location?.toLowerCase().trim();
        if (seen.has(loc)) return false;
        seen.add(loc);
        return true;
      });
    };

    const createLocationNode = (locationName, locationMachines) => {
      if (locationMachines.length === 0) return null;

      const sortedMachines = [...locationMachines].sort((a, b) =>
        a.machine_name.localeCompare(b.machine_name, 'vi')
      );

      return {
        label: locationName,
        icon: 'bi-geo-alt',
        children: sortedMachines.map((machine) => ({
          label: machine.machine_name,
          machine_id: machine.machine_id,
          icon: 'bi-cpu',
        })),
      };
    };

    const groupedDuyTanLocations = uniqueByLocation(duyTanLocations)
      .sort((a, b) => a.location.localeCompare(b.location, 'vi'))
      .map((loc) => {
        const locationMachines = machines.filter(
          (m) => m.location?.toLowerCase().trim() === loc.location?.toLowerCase().trim()
        );
        return createLocationNode(loc.location, locationMachines);
      })
      .filter((node) => node !== null);

    if (groupedDuyTanLocations.length > 0) {
      tree.push({
        label: 'TRONG DUY TÂN GROUP',
        icon: 'bi-building',
        children: groupedDuyTanLocations,
      });
    }

    const groupedOtherLocations = uniqueByLocation(otherLocations)
      .sort((a, b) => a.location.localeCompare(b.location, 'vi'))
      .map((loc) => {
        const locationMachines = machines.filter(
          (m) => m.location?.toLowerCase().trim() === loc.location?.toLowerCase().trim()
        );
        return createLocationNode(loc.location, locationMachines);
      })
      .filter((node) => node !== null);

    if (groupedOtherLocations.length > 0) {
      tree.push({
        label: 'NGOÀI DUY TÂN GROUP',
        icon: 'bi-building',
        children: groupedOtherLocations,
      });
    }

    return tree;
  };

  const treeData = buildTreeData();

  const handleMachineClick = (machineId) => {
    navigate(`/machines/${machineId}`);
  };

  const { width: sidebarWidth, isResizing, onResizeStart } = useTreeSidebarResize();

  if (width <= 1200) return null;

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" />

      <div
        className="machine-tree-sidebar-wrapper px-0"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          maxWidth: sidebarWidth,
          flex: `0 0 ${sidebarWidth}px`,
        }}
      >
        <div className="machine-tree-sidebar px-0">
          <div className="px-0 py-2">
            {treeData.length > 0 ? (
              <div className="machine-tree">
                {treeData.map((node, index) => (
                  <TreeNode
                    key={index}
                    node={node}
                    onMachineClick={handleMachineClick}
                    selectedMachineId={selectedMachineId}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <i className="bi bi-inbox tree-empty-icon" />
                <p className="text-muted mb-0 mt-2" style={{ fontSize: '13px' }}>
                  Không có máy nào tại vị trí này
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className={`machine-tree-sidebar-resizer${isResizing ? ' machine-tree-sidebar-resizer--active' : ''}`}
          onMouseDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để thay đổi độ rộng danh sách máy"
          title="Kéo để thay đổi độ rộng"
        />
      </div>
    </>
  );
};

export default MachineTreeSidebar;
