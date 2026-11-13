import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import AppNavbar from '../components/Navbar';
import "../css/Home.css"
import "../index.css"
import { Edit, Trash2, Power, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { BASE_URL } from '../config/config';
import { POLL_INTERVALS } from '../config/polling';
import usePolling from '../hooks/usePolling';
import useNow from '../hooks/useNow';
import useResizableTableColumns from '../hooks/useResizableTableColumns';
import useTreeSidebarResize from '../hooks/useTreeSidebarResize';
import ResizableTableHeader from '../components/home/ResizableTableHeader';
import HomeLocationTree from '../components/home/HomeLocationTree';
import {
  getMachineStatusLabelWithEmojiForDisplay,
} from '../utils/machineStatus';
import {
  readInitialHomePageFilters,
  saveHomePageFilters,
} from '../utils/homePageState';
import '../css/MachineTree.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const HOME_TREE_MOBILE_BP = 1200;

const HOME_MACHINE_TABLE_COLUMN_ORDER = ['name', 'machineId', 'status', 'actions'];

const HOME_MACHINE_TABLE_COLUMNS = {
  name: 35,
  machineId: 25,
  status: 22,
  actions: 18,
};

const HOME_MACHINE_TABLE_MIN = {
  name: 12,
  machineId: 10,
  status: 12,
  actions: 12,
};

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = readInitialHomePageFilters(searchParams);
  const now = useNow(POLL_INTERVALS.connectionTick);
  const [machines, setMachines] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(
    () => initialFilters.selectedLocation,
  );

  const [isEditMachineModalOpen, setIsEditMachineModalOpen] = useState(false);
  const [user, setUser] = useState(null);

  const [duyTanLocations, setDuyTanLocations] = useState([]);
  const [otherLocations, setOtherLocations] = useState([]);
  const [isDuyTanGroupSelected, setIsDuyTanGroupSelected] = useState(
    () => initialFilters.isDuyTanGroupSelected,
  );

  const [isCreateMachineModalOpen, setIsCreateMachineModalOpen] = useState(false);
  const [newMachineForm, setNewMachineForm] = useState({
    machine_name: '',
    machine_id: '',
    location: '',
    image_url: null,
    isdtgroup: false,

    output_name: '',
    output_unit: '',
    input_name: '',
    input_unit: '',
  });

  const [editMachineForm, setEditMachineForm] = useState({
    machine_id: '',
    machine_name: '',
    location: '',
    information: '',
    unit: '',
  });

  const role = localStorage.getItem('role');
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : HOME_TREE_MOBILE_BP + 1,
  );
  const [treeOpen, setTreeOpen] = useState(false);
  const offcanvasRef = useRef(null);
  const [offcanvasInstance, setOffcanvasInstance] = useState(null);
  const showTreeToggle = width < HOME_TREE_MOBILE_BP;

  const handleEditMachineFormChange = (e) => {
    const { name, value } = e.target;
    setEditMachineForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const navigate = useNavigate();
  const { widthsPercent: tableColWidths, resizingKey, onResizeStart: onTableColResizeStart } =
    useResizableTableColumns(
      'home_machine_table_column_percent',
      HOME_MACHINE_TABLE_COLUMN_ORDER,
      HOME_MACHINE_TABLE_COLUMNS,
      HOME_MACHINE_TABLE_MIN,
    );
  const {
    width: areaSidebarWidth,
    isResizing: isAreaSidebarResizing,
    onResizeStart: onAreaSidebarResizeStart,
  } = useTreeSidebarResize({
    storageKey: 'home_area_sidebar_width',
    defaultWidth: 280,
    minWidth: 200,
    maxWidth: 480,
  });

    // 🧩 Lấy thông tin người dùng hiện tại
  const fetchUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      setUser(data);
      localStorage.setItem('role', data.role || 'user');
    } catch (err) {
      console.error('Error fetching user:', err);
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const handleDeleteMachine = async (machine_id) => {

    const token = localStorage.getItem('token'); // ✅ lấy token
    if (!token) {
      alert("Bạn không có quyền xóa máy này!");
      return;
    }
    const confirmDelete = window.confirm("Bạn có chắc muốn xoá máy này?");
    if (!confirmDelete) return;

      try {
        await axios.delete(`${BASE_URL}/api/machines/${machine_id}`, {
          headers: {
            Authorization: `Bearer ${token}`, // ✅ gửi token
          },
        });

        // Cập nhật lại danh sách máy
        setMachines(prev => prev.filter(m => m.machine_id !== machine_id));
      } catch (err) {
        console.error(err.message);
        alert('Không thể xoá máy. Vui lòng thử lại.');
      }
    };
  
  const getMachineStatusText = (machine) =>
    getMachineStatusLabelWithEmojiForDisplay(machine.status, machine.last_updated, now);

  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/locations`);
      const jsonData = response.data;
      setDuyTanLocations(jsonData.dtGroup || []);
      setOtherLocations(jsonData.nonDtGroup || []);
    } catch (err) {
      console.error(err.message);
    }
  };

  const locationSuggestions = newMachineForm.isdtgroup ? duyTanLocations : otherLocations;

  const handleSaveMachineInfo = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Bạn không có quyền chỉnh sửa máy!");
      return;
    }

    try {
      const response = await axios.put(
        `${BASE_URL}/api/machines/${editMachineForm.machine_id}`,
        {
          machine_name: editMachineForm.machine_name,
          location: editMachineForm.location,
          information: editMachineForm.information,
          // 👇 thêm mới
          output_name: editMachineForm.output_name,
          output_unit: editMachineForm.output_unit,
          input_name: editMachineForm.input_name,
          input_unit: editMachineForm.input_unit,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response.data;

      alert(data?.message || 'Cập nhật thành công!');
      setIsEditMachineModalOpen(false);
    } catch (err) {
      alert('Lỗi server khi lưu thông tin máy!');
    }
  };


  const handleLocationSelect = (location, isDuyTanGroup) => {
    setIsDuyTanGroupSelected(Boolean(isDuyTanGroup));
    setSelectedLocation(location);
    offcanvasInstance?.hide();
  };

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showTreeToggle || !offcanvasRef.current) {
      setOffcanvasInstance(null);
      setTreeOpen(false);
      return undefined;
    }
    const el = offcanvasRef.current;
    const instance = Offcanvas.getOrCreateInstance(el);
    setOffcanvasInstance(instance);
    const handleShown = () => setTreeOpen(true);
    const handleHidden = () => setTreeOpen(false);
    el.addEventListener('shown.bs.offcanvas', handleShown);
    el.addEventListener('hidden.bs.offcanvas', handleHidden);
    return () => {
      el.removeEventListener('shown.bs.offcanvas', handleShown);
      el.removeEventListener('hidden.bs.offcanvas', handleHidden);
    };
  }, [showTreeToggle]);

  const toggleAreaTree = () => {
    if (!offcanvasRef.current) return;
    Offcanvas.getOrCreateInstance(offcanvasRef.current).toggle();
  };

  const fetchMachinesForLocation = useCallback(async () => {
    if (!selectedLocation) return;
    try {
      const response = await axios.get(
        `${BASE_URL}/api/machines?location=${encodeURIComponent(selectedLocation)}&isdtgroup=${isDuyTanGroupSelected}`
      );
      setMachines(response.data);
    } catch (err) {
      console.error(err.message);
    }
  }, [selectedLocation, isDuyTanGroupSelected]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "machine_id") {
      // Chỉ giữ lại chữ cái thường, số và dấu gạch dưới
      const formatted = value
        .toLowerCase()           // chuyển về chữ thường
        .replace(/[^a-z0-9_]/g, ""); // loại bỏ ký tự không hợp lệ

      setNewMachineForm({
        ...newMachineForm,
        [name]: formatted,
      });
    } else {
      // Các trường khác giữ nguyên
      setNewMachineForm({
        ...newMachineForm,
        [name]: value,
      });
    }
  };

  const handleCreateMachine = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Bạn không có quyền thêm máy!");
      return;
    }

    try {
      const formData = new FormData();

      formData.append('machine_id', newMachineForm.machine_id);
      formData.append('machine_name', newMachineForm.machine_name);
      formData.append('location', newMachineForm.location);
      formData.append('unit', newMachineForm.unit);
      formData.append('isdtgroup', newMachineForm.isdtgroup ? 'true' : 'false');

      formData.append('output_name', newMachineForm.output_name);
      formData.append('output_unit', newMachineForm.output_unit);
      formData.append('input_name', newMachineForm.input_name);
      formData.append('input_unit', newMachineForm.input_unit);

      if (newMachineForm.image) {
        formData.append('image_url', newMachineForm.image);
      }

      for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
      }

      await axios.post(`${BASE_URL}/api/machines`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // ✅ reset form đúng
      setIsCreateMachineModalOpen(false);
      setNewMachineForm({
        machine_name: '',
        machine_id: '',
        location: '',
        image: null,
        unit: '',           // ✅ reset unit
        isdtgroup: false    // ✅ reset checkbox
      });

      // reload lại danh sách nếu cùng location
      if (selectedLocation === newMachineForm.location) {
        fetchMachinesForLocation();
      }

    } catch (err) {
      console.error(err.response?.data || err.message);
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Không thể thêm máy mới. Vui lòng thử lại.';
      alert(message);
    }
  };


  useEffect(() => {
    fetchLocations();
    fetchUser();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedLocation) {
      params.set('location', selectedLocation);
    }
    params.set('group', isDuyTanGroupSelected ? 'duytan' : 'other');
    setSearchParams(params, { replace: true });
    saveHomePageFilters({ selectedLocation, isDuyTanGroupSelected });
  }, [selectedLocation, isDuyTanGroupSelected, setSearchParams]);

  useEffect(() => {
    fetchMachinesForLocation();
  }, [fetchMachinesForLocation]);

  usePolling(fetchMachinesForLocation, POLL_INTERVALS.status, Boolean(selectedLocation));

  return (
    <div className="app-page-bg home-page" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <AppNavbar />

      {showTreeToggle && !treeOpen ? (
        <button
          type="button"
          className="home-sidebar-pull"
          onClick={toggleAreaTree}
          aria-label="Mở khu vực nhà máy"
          aria-controls="offcanvasHomeAreaTree"
          title="Khu vực nhà máy"
        >
          <span className="home-sidebar-pull__grip" aria-hidden="true" />
          <i className="bi bi-chevron-right home-sidebar-pull__icon" aria-hidden="true" />
        </button>
      ) : null}

      <div className="container-fluid py-2 g-0" style={{ height: '100%' }}>
        <div className="home-layout d-flex g-2 gap-2">
          <div
            className="home-area-sidebar-wrap mb-2"
            style={{
              width: areaSidebarWidth,
              minWidth: areaSidebarWidth,
              maxWidth: areaSidebarWidth,
              flex: `0 0 ${areaSidebarWidth}px`,
            }}
          >
            <div className="home-area-card p-2 rounded d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="fw-bold mb-0 text-brand">
                  🏭 Khu vực nhà máy
                </h5>
                {role === 'admin' && (
                  <button
                    type="button"
                    className="btn btn-sm home-area-add-btn"
                    title="Thêm máy mới"
                    onClick={() => setIsCreateMachineModalOpen(true)}
                  >
                    ➕
                  </button>
                )}

              </div>
              <div className="home-location-tree-wrap flex-grow-1 min-h-0">
                <HomeLocationTree
                  duyTanLocations={duyTanLocations}
                  otherLocations={otherLocations}
                  selectedLocation={selectedLocation}
                  isDuyTanGroupSelected={isDuyTanGroupSelected}
                  onSelectLocation={handleLocationSelect}
                />
              </div>
            </div>
            <div
              className={`machine-tree-sidebar-resizer home-area-sidebar-resizer${
                isAreaSidebarResizing ? ' machine-tree-sidebar-resizer--active' : ''
              }`}
              onMouseDown={onAreaSidebarResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Kéo để thay đổi độ rộng khu vực nhà máy"
              title="Kéo để thay đổi độ rộng"
            />
          </div>

          {/* Main content - Machines */}
          <div className="home-machines-col flex-grow-1 min-w-0">
            <div className="home-machines-panel p-4 rounded d-flex flex-column">
              <h4 className="mb-1 text-brand">
                Danh sách máy {selectedLocation && `tại ${selectedLocation}`}
                {machines.length > 0 && ` (${machines.length} máy)`}
              </h4>
              <div className="row flex-grow-1 overflow-auto" style={{ minHeight: 0, marginTop: '8px', marginLeft: '-15px', width: 'calc(100% + 30px)'}}>
                <div className="col-12 px-0" style={{ maxHeight: '75vh', overflowY: 'auto', overflowX: 'hidden' }}>
                  <table className="table table-bordered table-hover align-middle bg-white shadow-sm resizable-table home-machine-table" style={{ fontSize: '15px' }}>
                    <colgroup>
                      <col style={{ width: tableColWidths.name }} />
                      <col style={{ width: tableColWidths.machineId }} />
                      <col style={{ width: tableColWidths.status }} />
                      <col style={{ width: tableColWidths.actions }} />
                    </colgroup>
                    <thead className="table-light text-center home-machine-table__thead">
                      <tr>
                        <ResizableTableHeader
                          columnKey="name"
                          width={tableColWidths.name}
                          label="Tên máy"
                          className="text-brand text-start"
                          onResizeStart={onTableColResizeStart}
                          isResizing={resizingKey === 'name'}
                        />
                        <ResizableTableHeader
                          columnKey="machineId"
                          width={tableColWidths.machineId}
                          label="ID máy"
                          className="text-brand"
                          onResizeStart={onTableColResizeStart}
                          isResizing={resizingKey === 'machineId'}
                        />
                        <ResizableTableHeader
                          columnKey="status"
                          width={tableColWidths.status}
                          label="Trạng thái"
                          className="text-brand"
                          onResizeStart={onTableColResizeStart}
                          isResizing={resizingKey === 'status'}
                        />
                        <ResizableTableHeader
                          columnKey="actions"
                          width={tableColWidths.actions}
                          label="Thao tác"
                          className="text-brand"
                          resizable={false}
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {machines.map((machine) => (
                        <tr
                          key={machine.machine_id}
                          onClick={() => navigate(`/machines/${machine.machine_id}`)}
                          style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                        >
                          <td className="text-brand" style={{ fontWeight: '500' }} title={machine.machine_name}>
                            {machine.machine_name}
                          </td>
                          <td className="text-muted text-center" title={machine.machine_id}>
                            {machine.machine_id}
                          </td>
                          <td className="text-center">
                            {getMachineStatusText(machine)}
                          </td>
                          <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            {role === 'admin' && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditMachineForm(machine);
                                    setIsEditMachineModalOpen(true);
                                  }}
                                  className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-all duration-200 transform hover:scale-110 shadow-sm"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMachine(machine.machine_id);
                                  }}
                                  className="p-2.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200 transform hover:scale-110 shadow-sm"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </td>

                        </tr>
                      ))}

                      {machines.length === 0 && selectedLocation && (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-4">
                            ⚠️ Không có máy nào trong khu vực này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditMachineModalOpen && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050
      }}
      onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '1rem',
            width: '90%',
            maxWidth: '480px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tiêu đề & nút đóng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 className="text-brand" style={{ margin: 0 }}>Chỉnh sửa thông tin máy</h5>
            <button
              className="btn-close"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditMachineModalOpen(false);
              }}
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          <hr />

          {/* Grid layout */}
          <div
            className="mt-3"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              rowGap: '12px',
              columnGap: '8px',
              alignItems: 'center',
            }}
          >
            <label className="mb-0 fw-semibold">ID máy:</label>
            <input
              className="form-control form-control-sm"
              name="machine_id"
              value={editMachineForm.machine_id}
              onChange={handleEditMachineFormChange}
              disabled
            />

            <label className="mb-0 fw-semibold">Tên máy:</label>
            <input
              className="form-control form-control-sm"
              name="machine_name"
              value={editMachineForm.machine_name}
              onChange={handleEditMachineFormChange}
            />

            <label className="mb-0 fw-semibold">Nhà máy:</label>
            <input
              className="form-control form-control-sm"
              name="location"
              value={editMachineForm.location}
              onChange={handleEditMachineFormChange}
            />

            {/* THÀNH PHẨM ĐẦU RA */}
            <label className="mb-0 fw-semibold">Tên TP đầu ra:</label>
            <input
              className="form-control form-control-sm"
              name="output_name"
              value={editMachineForm.output_name || ""}
              onChange={handleEditMachineFormChange}
            />

            <label className="mb-0 fw-semibold">Đơn vị TP đầu ra:</label>
            <input
              className="form-control form-control-sm"
              name="output_unit"
              value={editMachineForm.output_unit || ""}
              onChange={handleEditMachineFormChange}
            />

            {/* THÀNH PHẨM ĐẦU VÀO */}
            <label className="mb-0 fw-semibold">Tên TP đầu vào:</label>
            <input
              className="form-control form-control-sm"
              name="input_name"
              value={editMachineForm.input_name || ""}
              onChange={handleEditMachineFormChange}
            />

            <label className="mb-0 fw-semibold">Đơn vị TP đầu vào:</label>
            <input
              className="form-control form-control-sm"
              name="input_unit"
              value={editMachineForm.input_unit || ""}
              onChange={handleEditMachineFormChange}
            />

            <label className="mb-0 fw-semibold">Thông tin khác:</label>
            <textarea
              className="form-control form-control-sm"
              name="information"
              value={editMachineForm.information || ""}
              onChange={handleEditMachineFormChange}
              rows={4} // Số dòng hiển thị ban đầu
              style={{ resize: 'vertical' }} // Cho phép kéo rộng theo chiều dọc
            />
          </div>

          {/* Nút điều khiển */}
          <div className="d-flex justify-content-end mt-4 gap-2">
            <button className="btn btn-secondary" onClick={() => setIsEditMachineModalOpen(false)}>
              Đóng
            </button>
            <button className="btn btn-primary"
                    onClick={(e) => {
                e.stopPropagation();
                handleSaveMachineInfo();
              }}>
              Lưu
            </button>
          </div>
        </div>

      </div>
    )}

      {/* Modal thêm máy mới */}
      {isCreateMachineModalOpen && (
        <div
          className="app-modal app-modal-overlay"
          onClick={() => setIsCreateMachineModalOpen(false)}
        >
          <div
            className="app-modal-panel app-modal-panel--create"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="app-modal-title mb-3">🆕 Thêm máy mới</h5>
            <div className="mb-1">
              <label className="app-modal-label">Tên máy</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="machine_name"
                value={newMachineForm.machine_name}
                autoComplete="off"
                onChange={handleChange}
              />
            </div>
            <div className="mb-1">
              <label className="app-modal-label">ID máy</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="machine_id"
                value={newMachineForm.machine_id}
                autoComplete="off"
                placeholder="VD: 25031_10_26_4_1"
                onChange={handleChange}
              />
            </div>
            <div className="mb-1">
              <label className="app-modal-label">Nhà máy</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="location"
                list="location-options"
                value={newMachineForm.location}
                autoComplete="off"
                onChange={handleChange}
              />
              <datalist id="location-options">
                {locationSuggestions.map((loc, index) => (
                  <option key={index} value={loc.location} />
                ))}
              </datalist>
            </div>

            {/* THÀNH PHẨM ĐẦU RA */}
            <div className="mb-1">
              <label className="app-modal-label">Tên thành phẩm đầu ra (không bắt buộc)</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="output_name"
                value={newMachineForm.output_name || ""}
                autoComplete="off"
                onChange={handleChange}
              />
            </div>

            <div className="mb-1">
              <label className="app-modal-label">Đơn vị đầu ra (không bắt buộc)</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="output_unit"
                value={newMachineForm.output_unit || ""}
                autoComplete="off"
                placeholder="VD: cái, kg..."
                onChange={handleChange}
              />
            </div>

            {/* THÀNH PHẨM ĐẦU VÀO */}
            <div className="mb-1">
              <label className="app-modal-label">Tên thành phẩm đầu vào</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="input_name"
                value={newMachineForm.input_name || ""}
                autoComplete="off"
                onChange={handleChange}
              />
            </div>

            <div className="mb-1">
              <label className="app-modal-label">Đơn vị đầu vào</label>
              <input
                type="text"
                className="form-control app-modal-input"
                name="input_unit"
                value={newMachineForm.input_unit || ""}
                autoComplete="off"
                placeholder="VD: kg, m3..."
                onChange={handleChange}
              />
            </div>
            <div className="mb-3">
              <label className="app-modal-label">Hình ảnh</label>
              <input
                type="file"
                accept="image/*"
                className="form-control app-modal-input"
                onChange={(e) => setNewMachineForm(prev => ({ ...prev, image: e.target.files[0] }))}
              />
            </div>
            <div className="form-check mb-1">
              <input
                className="form-check-input"
                type="checkbox"
                id="isdtgroup"
                checked={newMachineForm.isdtgroup}
                onChange={(e) =>
                  setNewMachineForm((prev) => ({
                    ...prev,
                    isdtgroup: e.target.checked,
                  }))
                }
              />
              <label className="form-check-label" htmlFor="isdtgroup">
                NHÀ MÁY THUỘC DUY TÂN
              </label>
            </div>

            <div className="d-flex justify-content-end mt-3 gap-2">
              <button
                type="button"
                className="btn app-modal-btn-outline"
                onClick={() => setIsCreateMachineModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn app-modal-btn-primary px-4"
                onClick={handleCreateMachine}
                disabled={
                  !newMachineForm.machine_name ||
                  !newMachineForm.machine_id ||
                  !newMachineForm.location ||
                  !newMachineForm.image ||
                  !newMachineForm.input_name ||
                  !newMachineForm.input_unit
                }
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {showTreeToggle ? (
        <div
          className="offcanvas offcanvas-start home-area-offcanvas"
          tabIndex="-1"
          id="offcanvasHomeAreaTree"
          ref={offcanvasRef}
          aria-labelledby="offcanvasHomeAreaTreeLabel"
        >
          <div className="offcanvas-header home-area-offcanvas__header">
            <h5 className="mb-0 text-brand" id="offcanvasHomeAreaTreeLabel">
              Khu vực nhà máy
            </h5>
            <div className="d-flex align-items-center gap-2">
              {role === 'admin' ? (
                <button
                  type="button"
                  className="btn btn-sm home-area-add-btn"
                  title="Thêm máy mới"
                  onClick={() => {
                    offcanvasInstance?.hide();
                    setIsCreateMachineModalOpen(true);
                  }}
                >
                  ➕
                </button>
              ) : null}
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="offcanvas"
                aria-label="Đóng"
              />
            </div>
          </div>
          <div className="offcanvas-body home-area-offcanvas__body">
            <HomeLocationTree
              duyTanLocations={duyTanLocations}
              otherLocations={otherLocations}
              selectedLocation={selectedLocation}
              isDuyTanGroupSelected={isDuyTanGroupSelected}
              onSelectLocation={handleLocationSelect}
            />
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default HomePage;
