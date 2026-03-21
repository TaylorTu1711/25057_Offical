import React, { useState } from 'react';

const TreeNode = ({ node, level = 0, onMachineClick, selectedMachineId, isLastChild = false }) => {
  const hasChildren = node.children && node.children.length > 0;
  const [manualExpand, setManualExpand] = useState(null);

  const containsSelectedMachine = (node) => {
    if (node.machine_id === selectedMachineId) return true;
    if (node.children) {
      return node.children.some(child => containsSelectedMachine(child));
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

  return (
    <div className="tree-node">
      <div
        className={`tree-item d-flex align-items-center ${isActive ? 'active' : ''}`}
        style={{
          paddingLeft: `${level * 16 + 12}px`,
          cursor: node.machine_id || hasChildren ? 'pointer' : 'default',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '2px',
          backgroundColor: isActive ? 'rgba(32, 64, 154, 0.1)' : 'transparent',
          borderLeft: isActive ? '3px solid #20409a' : '3px solid transparent',
          color: isActive ? '#20409a' : '#495057',
          transition: 'all 0.2s ease',
          fontWeight: isActive ? '600' : (level === 0 ? '600' : level === 1 ? '500' : '400')
        }}
        onClick={node.machine_id ? handleClick : toggleExpand}
        onMouseEnter={(e) => {
          if (!isActive && node.machine_id) {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {hasChildren && (
          <i 
            className={`bi bi-chevron-${shouldExpand ? 'down' : 'right'}`}
            onClick={toggleExpand}
            style={{ 
              fontSize: '11px',
              marginRight: '8px',
              fontWeight: 'bold',
              color: level === 0 ? '#20409a' : '#6c757d'
            }}
          ></i>
        )}
        {!hasChildren && level > 0 && <span style={{ width: '15px', display: 'inline-block' }}></span>}
        
        <i 
          className={`bi ${node.icon}`}
          style={{ 
            fontSize: level === 0 ? '15px' : '13px',
            marginRight: '8px',
            color: isActive ? '#20409a' : (level === 0 ? '#0d6efd' : level === 1 ? '#198754' : '#6c757d')
          }}
        ></i>
        <span style={{ 
          fontSize: level === 0 ? '14px' : '13px',
          color: level === 0 ? 'rgba(32, 64, 154, 1)' : undefined,
        }}>
          {node.label}
        </span>
      </div>

      {hasChildren && shouldExpand && (
        <div 
          className="tree-children" 
          style={{ 
            // Thêm border-left để tạo đường kẻ dọc nối các mục con
            borderLeft: level >= 0 ? '1px dashed #203E9A' : 'none',
            marginLeft: level >= 0 ? '20px' : '12px',
            paddingLeft: level >= 0 ? '8px' : '0'
          }}
        >
          {node.children.map((child, index) => (
            <React.Fragment key={index}>
              <TreeNode 
                node={child} 
                level={level + 1}
                onMachineClick={onMachineClick}
                selectedMachineId={selectedMachineId}
                isLastChild={index === node.children.length - 1}
              />
              {/* Thêm đường kẻ ngang phân cách giữa các mục con (trừ mục cuối) */}
              {index < node.children.length - 1 && level >= 1 && (
                <div 
                  style={{
                    borderBottom: '1px solid #e9ecef',
                    margin: '4px 12px 4px 20px',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const MachineTreeSidebar = ({ 
  machines = [],
  machineInfor,
  navigate,
  width,
  selectedMachineId,
  dtGroup = [],
  nonDtGroup = []
}) => {
  const buildTreeData = () => {
    if (!machines || machines.length === 0) return [];

    const tree = [];

    const uniqueByLocation = (arr) => {
      const seen = new Set();
      return arr.filter(item => {
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
        children: sortedMachines.map(machine => ({
          label: machine.machine_name,
          machine_id: machine.machine_id,
        }))
      };
    };

    const duyTanLocations = uniqueByLocation(dtGroup)
      .sort((a, b) => a.location.localeCompare(b.location, 'vi'))
      .map(loc => {
        const locationMachines = machines.filter(
          m => m.location?.toLowerCase().trim() === loc.location?.toLowerCase().trim()
        );
        return createLocationNode(loc.location, locationMachines);
      }).filter(node => node !== null);

    if (duyTanLocations.length > 0) {
      tree.push({
        label: 'TRONG DUY TÂN GROUP',
        children: duyTanLocations
      });
    }

    const khacLocations = uniqueByLocation(nonDtGroup)
      .sort((a, b) => a.location.localeCompare(b.location, 'vi'))
      .map(loc => {
        const locationMachines = machines.filter(
          m => m.location?.toLowerCase().trim() === loc.location?.toLowerCase().trim()
        );
        return createLocationNode(loc.location, locationMachines);
      }).filter(node => node !== null);

    if (khacLocations.length > 0) {
      tree.push({
        label: 'Ngoài Duy Tân Group',
        children: khacLocations
      });
    }

    return tree;
  };

  const treeData = buildTreeData();

  const handleMachineClick = (machineId) => {
    navigate(`/machines/${machineId}`);
  };

  if (width <= 1200) return null;

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" />
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tree-item {
          animation: fadeIn 0.3s ease-in;
        }
        .tree-item:hover {
          background-color: #f8f9fa;
        }
      `}</style>

      <div 
        className="col-auto px-0" 
        style={{ 
          background: "#fff",
          height: '100%',
          overflowY: 'auto',
          width: '250px',
          flexShrink: 0,
          borderLeft: '1px solid #e9ecef'
        }}
      >
        <div className="px-0 py-2">
          {treeData.length > 0 ? (
            <div className="machine-tree">
              {treeData.map((node, index) => (
                <React.Fragment key={index}>
                  <TreeNode 
                    node={node}
                    onMachineClick={handleMachineClick}
                    selectedMachineId={selectedMachineId}
                  />
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <i className="bi bi-inbox" style={{ fontSize: '32px', color: '#dee2e6' }}></i>
              <p className="text-muted mb-0 mt-2" style={{ fontSize: '13px' }}>
                Không có máy nào tại vị trí này
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MachineTreeSidebar;
