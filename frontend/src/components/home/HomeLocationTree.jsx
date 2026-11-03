import React, { useMemo, useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../css/MachineTree.css';

function LocationTreeNode({
  node,
  level = 0,
  selectedLocation,
  selectedGroupKey,
  onSelectLocation,
  defaultExpanded = false,
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isSelectedLocation =
    Boolean(node.location)
    && selectedLocation === node.location
    && selectedGroupKey === node.groupKey;
  const containsSelected = (() => {
    if (isSelectedLocation) return true;
    if (!hasChildren) return false;
    return node.children.some(
      (child) =>
        child.location === selectedLocation && child.groupKey === selectedGroupKey,
    );
  })();

  const [manualExpand, setManualExpand] = useState(null);
  const shouldExpand = manualExpand !== null ? manualExpand : (defaultExpanded || containsSelected);

  const toggleExpand = (e) => {
    e?.stopPropagation?.();
    if (hasChildren) setManualExpand(!shouldExpand);
  };

  const handleClick = () => {
    if (node.location) {
      onSelectLocation(node.location, node.isDuyTanGroup);
      return;
    }
    toggleExpand();
  };

  const weightClass =
    level === 0 ? 'tree-item--weight-0' : level === 1 ? 'tree-item--weight-1' : 'tree-item--weight-2';

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${weightClass} ${isSelectedLocation ? 'tree-item--active' : ''} ${
          !node.location && !hasChildren ? 'tree-item--default-cursor' : ''
        }`}
        onClick={handleClick}
        role="treeitem"
        aria-expanded={hasChildren ? shouldExpand : undefined}
        aria-selected={isSelectedLocation}
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
            level === 0
              ? 'tree-item__icon--level0'
              : level === 1
                ? 'tree-item__icon--level1'
                : 'tree-item__icon--muted'
          }`}
        />
        <span
          className={`tree-item__label ${level === 0 ? 'tree-item__label--level0' : ''}`}
          title={node.label}
        >
          {node.label}
        </span>
      </div>

      {hasChildren && shouldExpand ? (
        <div className="tree-children" role="group">
          {node.children.map((child) => (
            <LocationTreeNode
              key={`${child.groupKey || 'g'}:${child.location || child.label}`}
              node={child}
              level={level + 1}
              selectedLocation={selectedLocation}
              selectedGroupKey={selectedGroupKey}
              onSelectLocation={onSelectLocation}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cây thư mục khu vực: DUY TÂN / KHÁC → các nhà máy (location).
 */
export default function HomeLocationTree({
  duyTanLocations = [],
  otherLocations = [],
  selectedLocation = null,
  isDuyTanGroupSelected = true,
  onSelectLocation,
}) {
  const selectedGroupKey = isDuyTanGroupSelected ? 'duytan' : 'other';

  const treeData = useMemo(() => {
    const sortLocs = (arr) =>
      [...(arr || [])].sort((a, b) =>
        String(a.location || '').localeCompare(String(b.location || ''), 'vi'),
      );

    const toChildren = (locs, isDuyTanGroup, groupKey) =>
      sortLocs(locs).map((loc) => ({
        label: loc.location,
        location: loc.location,
        isDuyTanGroup,
        groupKey,
        icon: 'bi-geo-alt',
      }));

    return [
      {
        label: 'Trong Duy Tân Group',
        icon: 'bi-building',
        groupKey: 'duytan',
        children: toChildren(duyTanLocations, true, 'duytan'),
      },
      {
        label: 'Ngoài Duy Tân Group',
        icon: 'bi-building',
        groupKey: 'other',
        children: toChildren(otherLocations, false, 'other'),
      },
    ];
  }, [duyTanLocations, otherLocations]);

  return (
    <div className="machine-tree-sidebar home-location-tree" role="tree" aria-label="Khu vực nhà máy">
      <div className="machine-tree">
        {treeData.map((node) => (
          <LocationTreeNode
            key={node.groupKey}
            node={node}
            selectedLocation={selectedLocation}
            selectedGroupKey={selectedGroupKey}
            onSelectLocation={onSelectLocation}
            defaultExpanded={node.groupKey === selectedGroupKey}
          />
        ))}
      </div>
    </div>
  );
}
