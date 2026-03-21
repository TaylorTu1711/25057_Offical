import React, { useState } from 'react';



  const TreeNode = ({ node, level = 0, onMachineClick, selectedMachineId }) => {
  const hasChildren = node.children && node.children.length > 0;
  const [manualExpand, setManualExpand] = useState(null);

  // ✅ Kiểm tra xem node (hoặc con của nó) có chứa máy đang chọn không
  const containsSelectedMachine = (node) => {
    if (node.machine_id === selectedMachineId) return true;
    if (node.children) {
      return node.children.some(child => containsSelectedMachine(child));
    }
    return false;
  };

  // ✅ Nếu node chứa máy được chọn → mở ra, ngược lại đóng
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
        <div className="tree-children" style={{ marginLeft: '12px' }}>
          {node.children.map((child, index) => (
            <TreeNode 
              key={index} 
              node={child} 
              level={level + 1}
              onMachineClick={onMachineClick}
              selectedMachineId={selectedMachineId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Component tích hợp vào sidebar máy
const MachineTreeSidebarMobile = ({ 
  machines = [],
  machineInfor,
  navigate,
  width,
  selectedMachineId,
  dtGroup = [], // Danh sách locations thuộc Duy Tân
  nonDtGroup = [] // Danh sách locations thuộc Khác
}) => {
  // Tạo cấu trúc tree từ danh sách máy với cấp Duy Tân/Khác
    const buildTreeData = () => {
    if (!machines || machines.length === 0) return [];

    const tree = [];

    // Hàm loại trùng location
    const uniqueByLocation = (arr) => {
        const seen = new Set();
        return arr.filter(item => {
        const loc = item.location?.toLowerCase().trim();
        if (seen.has(loc)) return false;
        seen.add(loc);
        return true;
        });
    };

    // Hàm tạo cấu trúc con cho mỗi location
    const createLocationNode = (locationName, locationMachines) => {
        if (locationMachines.length === 0) return null;

        const groups = {};
        locationMachines.forEach(machine => {
        const prefix = machine.machine_name.split(' ').slice(0, 2).join(' ');
        const category = prefix || 'Khác';
        if (!groups[category]) groups[category] = [];
        groups[category].push({
            label: machine.machine_name,
            machine_id: machine.machine_id,
        });
        });

        if (Object.keys(groups).length === 1 || locationMachines.length <= 3) {
        return {
            label: locationName,
            children: locationMachines.map(machine => ({
            label: machine.machine_name,
            machine_id: machine.machine_id,
            }))
        };
        }

        return {
        label: locationName,
        children: Object.keys(groups).map(category => ({
            label: category,
            children: groups[category]
        }))
        };
    };

    // ✅ Tạo nhánh Duy Tân (luôn hiển thị)
    const duyTanLocations = uniqueByLocation(dtGroup).map(loc => {
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

    // ✅ Tạo nhánh Khác (luôn hiển thị)
    const khacLocations = uniqueByLocation(nonDtGroup).map(loc => {
        const locationMachines = machines.filter(
        m => m.location?.toLowerCase().trim() === loc.location?.toLowerCase().trim()
        );
        return createLocationNode(loc.location, locationMachines);
    }).filter(node => node !== null);

    if (khacLocations.length > 0) {
        tree.push({
        label: 'Khác',
        children: khacLocations
        });
    }

    return tree;
    };


  const treeData = buildTreeData();

  const handleMachineClick = (machineId) => {
    navigate(`/machines/${machineId}`);
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css"
      />
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .tree-item {
          animation: fadeIn 0.3s ease-in;
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
        <div className="px-0 py-0">

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

export default MachineTreeSidebarMobile;
