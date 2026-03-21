
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import BarChart from '../components/BarChart';
import BarLineChart_Sanluong from '../components/BarChart_Thoigian';
import BarChartStatus from '../components/BarChart_Status';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate  } from 'react-router-dom';
import AppNavbar from '../components/Navbar';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PerformanceChart from '../components/PerformanceChart';
import { Offcanvas } from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../css/Machine.css'
import 'bootstrap-icons/font/bootstrap-icons.css';
import BarChart_Error from '../components/BarChart_AnalysisError';
import { BASE_URL } from '../config/config';
import MachineTreeSidebar from '../components/MachineTreeSidebar';
import MachineTreeSidebarMobile from '../components/MachineTreeSidebarMobile';


function Machine() {

  const [rawDataNotFilter, setRawDataNotFilter] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [monthLabels, setMonthLabels] = useState([]);
  const [monthLabelsChart2, setMonthLabelsChart2] = useState([]);
  const [labelsChart3, setLabelsChart3] = useState([]);
  const [statusDataValuesChart3, setStatusDataValuesChart3] = useState([]);
  const [timeRunMonthDataValues, setTimeRunMonthDataValues] = useState([]);
  const [timeErrorMonthDataValues, setTimeErrorMonthDataValues] = useState([]);
  const [timeStopMonthDataValues, setTimeStopMonthDataValues] = useState([]);
  const [productivityMonthDataValues, setProductivityMonthDataValues] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [paramMachine, setParamMachine] = useState([]);
  const [statusMachine, setStatusMachine] = useState([]);
  const [errorsMachine, setErrorsMachine] = useState([]);
  const [yearLabels, setYearLabels] = useState([]);
  const [yearLabelsChart2, setYearLabelsChart2] = useState([]);
  const [productivityYearDataValues, setProductivityYearDataValues] = useState([]);
  const [timerRunYearDataValues, setTimeRunYearDataValues] = useState([]);
  const [timerErrorYearDataValues, setTimeErrorYearDataValues] = useState([]);
  const [timerStopYearDataValues, setTimeStopYearDataValues] = useState([]);
  const [machineInfor, setMachineInfor] = useState([]);
  const [machines, setMachines] = useState([]);
  const [totalTimeOn, setTotalTimeOn] = useState([]);
  const [showTimeWindowChart1, setShowTimeWindowChart1] = useState(false);
  const [showTimeWindowChart2, setShowTimeWindowChart2] = useState(false);
  const [showTimeWindowChart3, setShowTimeWindowChart3] = useState(false);
  const [showInforMachine, setShowInforMachine] = useState(false);
  const [showAnalysisError, setShowAnalysisError] = useState(false);
  const [performanceMachine, setPerformanceMachine] = useState(false);
  const [shootMachine, setShootMachine] = useState(false);
  const [dtGroup, setDtGroup] = useState([]);
  const [nonDtGroup, setNonDtGroup] = useState([]);
  const [allLocations, setAllLocations] = useState([]);

  const [labelsChartErr, setLabelsChartErr] = useState([]);
  const [dataValuesChartErr, setDataValuesChartErr] = useState([]);

  const [viewModeChart1, setViewModeChart1] = useState('month');
  const [toDateChart1, setToDateChart1] = useState(new Date());
  const [fromDateChart1, setFromDateChart1] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const [tempViewModeChart1, setTempViewModeChart1] = useState('month');
  const [tempToDateChart1, setTempToDateChart1] = useState(new Date());
  const [tempFromDateChart1, setTempFromDateChart1] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  });

  const handleViewModeChart1Change = (value) => {
    setTempViewModeChart1(value);

    if (value === 'year') { // hiển thị theo tháng
      const now = new Date();
      setTempToDateChart1(now); // tháng hiện tại

      const date = new Date();
      date.setMonth(now.getMonth() - 12); // 12 tháng trước
      setTempFromDateChart1(date);
    }
    else if (value === 'month') { // hiển thị theo tháng
      const now = new Date();
      setTempToDateChart1(now); // tháng hiện tại

      const date = new Date();
      date.setMonth(now.getMonth() - 1); // 12 tháng trước
      setTempFromDateChart1(date);
    }
    
  };

  const [viewModeChart2, setViewModeChart2] = useState('month');
  const [toDateChart2, setToDateChart2] = useState(new Date());
  const [fromDateChart2, setFromDateChart2] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  });

  const [tempViewModeChart2, setTempViewModeChart2] = useState('month');
  const [tempToDateChart2, setTempToDateChart2] = useState(new Date());
  const [tempFromDateChart2, setTempFromDateChart2] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  });

  const handleViewModeChart2Change = (value) => {
    setTempViewModeChart2(value);

    if (value === 'year') { // hiển thị theo tháng
      const now = new Date();
      setTempToDateChart2(now); // tháng hiện tại

      const date = new Date();
      date.setMonth(now.getMonth() - 12); // 12 tháng trước
      setTempFromDateChart2(date);
    }
    else if (value === 'month') { // hiển thị theo tháng
      const now = new Date();
      setTempToDateChart2(now); // tháng hiện tại

      const date = new Date();
      date.setMonth(now.getMonth() - 1); // 12 tháng trước
      setTempFromDateChart2(date);
    }
    
  };


  const [toDateChart3, setToDateChart3] = useState(new Date());
  const [fromDateChart3, setFromDateChart3] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - 1440);
    return date;
  });

  const [tempToDateChart3, setTempToDateChart3] = useState(new Date());
  const [tempFromDateChart3, setTempFromDateChart3] = useState(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - 1440);
    return date;
  });

  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    // cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  

  const { machine_id } = useParams();
  const navigate = useNavigate();

  const getStatus = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/status?machine_id=${machine_id}`);
      const data = await res.json();
      setStatusMachine(data[0]);
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleBootData = async () => {
    try {
      if (!window.confirm("Bạn có chắc muốn dọn dữ liệu cũ?")) return;
      const res = await fetch(`${BASE_URL}/api/boot/${machine_id}`, {
        method: "DELETE",
      });
      const msg = await res.text();
      alert(msg);
    } catch (err) {
      console.error(err.message);
    }
  };



  const getMachineInfor = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/machines/${machine_id}`);
      const data = await res.json();
      setMachineInfor(data[0]);
    } catch (err) {
      console.error(err.message);
    }
  };

  const getAllLocations = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/locations/alllocations`);
      const jsonData = await response.json();

      // Nếu API trả về { locations: [...] }
      const all = jsonData.locations || [];

      // Chia ra 2 nhóm theo isdtgroup
      const dtGroup = all.filter(m => m.isdtgroup === true);
      const nonDtGroup = all.filter(m => !m.isdtgroup);

      // Cập nhật state
      setDtGroup(dtGroup);
      setNonDtGroup(nonDtGroup);
      setAllLocations(all); 

    } catch (err) {
      console.error(err.message);
    }
  };


  const handleUpdateTimeChart1 = () => {
    setFromDateChart1(tempFromDateChart1);
    setToDateChart1(tempToDateChart1);
    setViewModeChart1(tempViewModeChart1);
  };

  const handleCancelTimeChart1 = () => {
    setTempFromDateChart1(fromDateChart1);
    setTempToDateChart1(toDateChart1);
    setTempViewModeChart1(viewModeChart1);
  };

  const handleUpdateTimeChart2 = () => {
    setFromDateChart2(tempFromDateChart2);
    setToDateChart2(tempToDateChart2);
    setViewModeChart2(tempViewModeChart2);
  };

  const handleCancelTimeChart2 = () => {
    setTempFromDateChart2(fromDateChart2);
    setTempToDateChart2(toDateChart2);
    setTempViewModeChart2(viewModeChart2);
  };

  const handleUpdateTimeChart3 = () => {
    setFromDateChart3(tempFromDateChart3);
    setToDateChart3(tempToDateChart3);
  };

  const handleCancelTimeChart3 = () => {
    setTempFromDateChart3(fromDateChart3);
    setTempToDateChart3(toDateChart3);
  };

  const handleLocationClick = async (location, isdtgroup) => {    
    const response = await fetch(`${BASE_URL}/api/machines?location=${encodeURIComponent(location)}&isdtgroup=${isdtgroup}`);
    const jsonData = await response.json();
    setMachines(jsonData);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 0:
        return 'bg-warning text-dark';
      case 1:
        return 'bg-warning text-dark';
      case 2:
        return 'bg-success'; // text-dark để chữ không bị mờ trên nền vàng
      default:
        return 'bg-secondary';
    }
  };
    const convertStatusToString = (status) => {
    switch (status) {
      case 0:
        return 'Đang dừng';
      case 1:
        return 'Đang dừng';
      case 2:
        return 'Đang chạy'; // text-dark để chữ không bị mờ trên nền vàng
      default:
        return 'NA';
    }
  };

  const statusName = (status) => {
    switch (status) {
      case 1:
        return "ĐANG CHẠY";
      case 2:
        return 'ĐANG LỖI';
      case 3:
        return 'ĐANG DỪNG'; // text-dark để chữ không bị mờ trên nền vàng
      default:
        return 'N/A';
    }
  };

  const getErrorsMachine = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/errorsmachine?machine_id=${machine_id}`);
      const data = await res.json();

      // Sắp xếp theo thời gian giảm dần
      const sortedData = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Lọc lỗi trùng theo timestamp
      const uniqueErrors = sortedData.filter((error, index, self) =>
        index === self.findIndex((e) => e.timestamp === error.timestamp)
      );

      setErrorsMachine(uniqueErrors);

      // ✅ Thống kê số lần mỗi loại lỗi xuất hiện (dựa trên error_message)
      const errorCountMap = {};
      data.forEach((item) => {
        const key = item.alarm_name;
        errorCountMap[key] = (errorCountMap[key] || 0) + 1;
      });

      // Chuyển về mảng và sắp xếp giảm dần
      const sortedStats = Object.entries(errorCountMap)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);

      // Tách labels và dataValues cho chart
      const labels = sortedStats.map((item) => item.message);
      const dataValues = sortedStats.map((item) => item.count);

      // ✅ Truyền dữ liệu vào chart
      setLabelsChartErr(labels);
      setDataValuesChartErr(dataValues);

    } catch (err) {
      console.error(err.message);
    }
  };



  const getAllParamMachine = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${BASE_URL}/api/detailMachine?machine_id=${machine_id}`);
      const data = await res.json();

      setRawDataNotFilter(data);

      // Lọc lấy bản ghi cuối cùng của mỗi ngày
      const dataFilter = Object.values(
        data.reduce((acc, item) => {
          const date = item.timestamp.slice(0, 10); // ✅ Giữ đúng theo giờ VN
          if (!acc[date] || new Date(item.timestamp) > new Date(acc[date].timestamp)) { // ✅ So sánh chuỗi ISO an toàn
            acc[date] = item;
          }
          return acc;
        }, {})
      );

      const totalDays = new Set(
        dataFilter.map(item => item.timestamp.slice(0, 10))
      ).size;
      const totalHours = totalDays * 24;

      // Tổng thời gian mở máy
      const totalTimeOn = (dataFilter.reduce((sum, item) => sum + (item.time_on || 0), 0) / 3600).toFixed(1)
      setTotalTimeOn(totalTimeOn);

      setRawData(dataFilter);

      // Tính hiệu suất
      const normalizeDate = (iso) => new Date(iso).toISOString().split("T")[0];

      // Sắp xếp theo thời gian giảm dần
      const sortedData = [...dataFilter].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Nhóm theo ngày, lấy bản ghi mới nhất trong ngày
      const groupedByDate = {};
      sortedData.forEach((item) => {
        const date = normalizeDate(item.timestamp);
        if (!groupedByDate[date]) {
          groupedByDate[date] = item;
        }
      });

      const twoDatesNearest = Object.keys(groupedByDate).sort(
        (a, b) => new Date(b) - new Date(a)
      );

      // ✅ Nếu chỉ có 1 ngày hoặc không đủ dữ liệu
      if (twoDatesNearest.length < 2) {

        const onlyDay = groupedByDate[twoDatesNearest[0]];
        setShootMachine(onlyDay?.shoot || 0);
        setPerformanceMachine(0);
        return;
      }

      // Nếu đủ dữ liệu (>= 2 ngày)
      const timeOnNearestDay = groupedByDate[twoDatesNearest[0]].time_on /3600;
      const shootNearestDay = groupedByDate[twoDatesNearest[0]].shoot;
      setShootMachine(shootNearestDay);

      const actualShootNearestDay = groupedByDate[twoDatesNearest[0]].shoot - groupedByDate[twoDatesNearest[1]].shoot;

      // Tính thời gian cycle trung bình
      const dateNearest = [
        ...new Set(data.map((item) => normalizeDate(item.timestamp))),
      ];
      const latestDate = dateNearest.sort(
        (a, b) => new Date(b) - new Date(a)
      )[0];

      const recordsToday = data.filter(
        (item) => normalizeDate(item.timestamp) === latestDate
      );

      const cycleValues = recordsToday
        .map((item) => item.cycle)
        .filter((c) => c !== undefined && c !== null);

      const avgCycle =
        cycleValues.length > 0
          ? (
              cycleValues.reduce((a, b) => a + b, 0) / cycleValues.length
            ).toFixed(2)
          : null;

      //const performance = (actualShootNearestDay * (avgCycle/3600)) / timeOnNearestDay;
      
      //const performance = (timeOnNearestDay) / 24;

      const performance = (totalTimeOn) / totalHours;


      setPerformanceMachine(Number((performance * 100).toFixed(1)));
    } catch (err) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  const offcanvasRef = useRef(null);
  const [offcanvasInstance, setOffcanvasInstance] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  //ĐÓng mở Offcanvas
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!offcanvasRef.current) return;

      // Nếu chuột ở sát mép trái
      if (e.clientX < 10 && !isOpen) {
        const instance = Offcanvas.getOrCreateInstance(offcanvasRef.current);
        instance.show();
        setOffcanvasInstance(instance);
        setIsOpen(true);

        // Khi offcanvas đóng (do nút close hoặc gọi .hide())
        offcanvasRef.current.addEventListener(
          'hidden.bs.offcanvas',
          () => setIsOpen(false),
          { once: true }
        );
      }

      // Nếu chuột di chuyển ra xa > 100px và đang mở → đóng lại
      if (e.clientX > 400 && isOpen && offcanvasInstance) {
        offcanvasInstance.hide();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen, offcanvasInstance]);

  useEffect(() => {
    getStatus();
    getErrorsMachine();
    getAllParamMachine();                                         
    getMachineInfor();
    getAllLocations();
  }, [machine_id]);

  useEffect(() => {
    if (!selectedDay || !rawData.length) return;

    // Lọc dữ liệu trong ngày được chọn
    const dataInDay = rawData.filter(
      (d) => new Date(d.timestamp).toISOString().slice(0, 10) === selectedDay
    );

    // Tìm dữ liệu mới nhất trong ngày đó (timestamp lớn nhất)
    const latestData = dataInDay.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    , dataInDay[0]); // giá trị khởi đầu
    setParamMachine(latestData);
  }, [selectedDay, rawData]);

  useEffect(() => {
    
      // Lấy tất cả ngày trong khoảng fromDateChart1 -> toDateChart1
    const getAllDaysInRange = (start, end) => {
      const days = [];
      const date = new Date(start);
      while (date <= end) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
      return days;
    };

    // Lấy tất cả tháng trong khoảng fromDateChart1 -> toDateChart1
    const getAllMonthsInRange = (start, end) => {
      const months = [];
      const current = new Date(start.getFullYear(), start.getMonth(), 1);

      while (current <= end) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        months.push(key);
        current.setMonth(current.getMonth() + 1);
      }

      return months;
    };

    const daysInRange = getAllDaysInRange(fromDateChart1, toDateChart1);

    // Lọc dữ liệu trong khoảng thời gian
    const rangeFiltered = rawData.filter(d => {
      const ts = new Date(d.timestamp);
      return ts >= fromDateChart1 && ts <= toDateChart1;
    });

    const quantityMap = {};
    const timeRunMap = {};
    const timeErrorMap = {};
    const timeStopMap = {};

    rangeFiltered.forEach(d => {
      const dateStr = new Date(d.timestamp).toISOString().split('T')[0]; // "YYYY-MM-DD"
      quantityMap[dateStr] = d.product;
      timeRunMap[dateStr] = d.time_on/3600;
      timeErrorMap[dateStr] = d.time_off/3600;
      timeStopMap[dateStr] = d.time_off/3600;
    });


    const sameYear = daysInRange[0].getFullYear() === daysInRange[daysInRange.length - 1].getFullYear();

    const dayLabels = daysInRange.map(d => {
      if (sameYear) {
        // Hiển thị "DD-MM" nếu trong cùng 1 năm
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}-${month}`;
      } else {
        // Hiển thị "YYYY-MM-DD" nếu giao giữa hai năm
        return d.toISOString().split('T')[0];
      }
    });


    const productivityValues = daysInRange.map(d => {
      const dateStr = d.toISOString().split('T')[0];
      return quantityMap[dateStr] || 0;
    });


    setMonthLabels(dayLabels);
    setProductivityMonthDataValues(productivityValues);
    

    const quantityMonthMap = {};

    rangeFiltered.forEach((d) => {
      const ts = new Date(d.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;

      quantityMonthMap[key] = (quantityMonthMap[key] || 0) + d.product;
    });

    const monthKeys = getAllMonthsInRange(fromDateChart1, toDateChart1); // Từ bước 1

    const labels = monthKeys.map((key) => {
      const [year, month] = key.split('-');
      return `${parseInt(month)} - ${year}`;
    });

    const productivityMonthValues = monthKeys.map((key) => quantityMonthMap[key] || 0);


    setYearLabels(labels);
    setProductivityYearDataValues(productivityMonthValues);
    
  }, [rawData, showTimeWindowChart1]);

  useEffect(()=> {
    handleLocationClick(machineInfor.location, machineInfor.isdtgroup)
  }, [machineInfor]);

  const isConnected = (lastUpdated) => {
      if (!lastUpdated) return false;
      const last = new Date(lastUpdated);
      const now = new Date();
      const diffMinutes = (now - last) / 1000 / 60;
      return diffMinutes < 2; // giả sử mất kết nối nếu không gửi dữ liệu trong 2 phút
    };

  useEffect(() => {  
      // Lấy tất cả ngày trong khoảng fromDateChart1 -> toDateChart1
    const getAllDaysInRange = (start, end) => {
      const days = [];
      const date = new Date(start);
      while (date <= end) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
      return days;
    };

    // Lấy tất cả tháng trong khoảng fromDateChart1 -> toDateChart1
    const getAllMonthsInRange = (start, end) => {
      const months = [];
      const current = new Date(start.getFullYear(), start.getMonth(), 1);

      while (current <= end) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        months.push(key);
        current.setMonth(current.getMonth() + 1);
      }

      return months;
    };



    const daysInRange = getAllDaysInRange(fromDateChart2, toDateChart2);

    // Lọc dữ liệu trong khoảng thời gian
    const rangeFiltered = rawData.filter(d => {
      const ts = new Date(d.timestamp);
      return ts >= fromDateChart2 && ts <= toDateChart2;
    });


    const timeRunMap = {};
    const timeErrorMap = {};
    const timeStopMap = {};

    rangeFiltered.forEach(d => {
      const dateStr = new Date(d.timestamp).toISOString().split('T')[0]; // "YYYY-MM-DD"
      timeRunMap[dateStr] = d.time_on/3600;
      timeErrorMap[dateStr] = d.time_off/3600;
      timeStopMap[dateStr] = d.time_off/3600;
    });


    const sameYear = daysInRange[0].getFullYear() === daysInRange[daysInRange.length - 1].getFullYear();

    const dayLabels = daysInRange.map(d => {
      if (sameYear) {
        // Hiển thị "DD-MM" nếu trong cùng 1 năm
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}-${month}`;
      } else {
        // Hiển thị "YYYY-MM-DD" nếu giao giữa hai năm
        return d.toISOString().split('T')[0];
      }
    });


    const timeRunValue = daysInRange.map(d => {
      const dateStr = d.toISOString().split('T')[0];
      return timeRunMap[dateStr] || 0;
    });

    const timeErrorValue = daysInRange.map(d => {
      const dateStr = d.toISOString().split('T')[0];
      return timeErrorMap[dateStr] || 0;
    });

    const timeStopValue = daysInRange.map(d => {
      const dateStr = d.toISOString().split('T')[0];
      return timeStopMap[dateStr] || 0;
    });

    setMonthLabelsChart2(dayLabels);
    setTimeRunMonthDataValues(timeRunValue);
    setTimeErrorMonthDataValues(timeErrorValue);
    setTimeStopMonthDataValues(timeStopValue);

    const timeRunMonthMap = {};
    const timeErrorMonthMap = {};
    const timeStopMonthMap = {};

    rangeFiltered.forEach((d) => {
      const ts = new Date(d.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;

      timeRunMonthMap[key] = (timeRunMonthMap[key] || 0) + d.time_on/3600;
      timeErrorMonthMap[key] = (timeErrorMonthMap[key] || 0) + d.time_off/3600;
      timeStopMonthMap[key] = (timeStopMonthMap[key] || 0) + d.time_stop/3600;
    });

    const monthKeys = getAllMonthsInRange(fromDateChart2, toDateChart2); // Từ bước 1

    const labels = monthKeys.map((key) => {
      const [year, month] = key.split('-');
      return `${parseInt(month)} - ${year}`;
    });

    const timeRunMonthValues = monthKeys.map((key) => timeRunMonthMap[key] || 0);
    const timeErrorMonthValues = monthKeys.map((key) => timeErrorMonthMap[key] || 0);
    const timeStopMonthValues = monthKeys.map((key) => timeStopMonthMap[key] || 0);

    setYearLabelsChart2(labels);
    setTimeRunYearDataValues(timeRunMonthValues);
    setTimeErrorYearDataValues(timeErrorMonthValues);
    setTimeStopYearDataValues(timeStopMonthValues);   
  }, [rawData, showTimeWindowChart2]);

  function generateTimestampsInRange(start, end, intervalMinutes = 5) {
  const timestamps = [];
  const current = new Date(start);
  while (current <= end) {
    timestamps.push(new Date(current));
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }
  return timestamps;
}


  useEffect(() => {
    // Lọc dữ liệu trong khoảng thời gian
    const rangeFiltered = rawDataNotFilter.filter(d => {
      const ts = new Date(d.timestamp);
      return ts >= fromDateChart3 && ts <= toDateChart3;
    });
    

    // Sắp xếp theo thời gian tăng dần
    rangeFiltered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));


    const rangeTimestamps = generateTimestampsInRange(fromDateChart3, toDateChart3, 5); // mỗi 5 phút

  const mappedData = rangeTimestamps.map(t => {
    const match = rangeFiltered.find(d => {
      const dataTime = new Date(d.timestamp);
      return Math.abs(dataTime - t) < 1000 * 60 * 2.5; // khớp trong ±2.5 phút
    });
    return match ? match.status : null;
  });

  const labels = rangeTimestamps.map(t =>
    t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  );

    // Cập nhật biểu đồ
    setLabelsChart3(labels);
    setStatusDataValuesChart3(mappedData);      // ví dụ: "Đang chạy"

    
  }, [rawData, showTimeWindowChart3]);

  const currentDataChartProductivity = viewModeChart1 === 'month' ? productivityMonthDataValues : productivityYearDataValues;

  const minValueProductivity = currentDataChartProductivity.length > 0 ? Math.min(...currentDataChartProductivity) : 0;
  const maxValueProductivity = currentDataChartProductivity.length > 0 ? Math.max(...currentDataChartProductivity) : 0;
  const avgValueProductivity = currentDataChartProductivity.length > 0
    ? currentDataChartProductivity.reduce((sum, val) => sum + val, 0) / currentDataChartProductivity.length
    : 0;

  const currentDataChart2Productivity = viewModeChart1 === 'month' ? timeRunMonthDataValues : timerRunYearDataValues;

  const minValueTimeRun = currentDataChart2Productivity.length > 0 ? Math.min(...currentDataChart2Productivity) : 0;
  const maxValueTimeRun = currentDataChart2Productivity.length > 0 ? Math.max(...currentDataChart2Productivity) : 0;
  const avgValueTimeRun = currentDataChart2Productivity.length > 0
    ? currentDataChart2Productivity.reduce((sum, val) => sum + val, 0) / currentDataChart2Productivity.length
    : 0;


  return (
   <div style={{ backgroundColor: '#e5e5e5', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
    <AppNavbar />

    <div className="row" style={{ 
      fontFamily: 'Arial, sans-serif', 
      backgroundColor: '#e5e5e5', 
      flex: 1, 
      overflow: 'hidden',
      margin: 0,
      height: 'calc(100dvh - 56px)'
    }}>       
      {/* Sidebar - Danh sách máy */}
      {/* {width > 1200 && (
        <div className="col-auto px-2 py-2" style={{ 
          background: "#fff",
          height: '100%',
          overflowY: 'auto',
          width: '250px',
          flexShrink: 0
        }}>
          <h5 style={{
            fontSize: "18px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "rgba(32, 64, 154, 1)",
            whiteSpace: "normal",
            wordWrap: "break-word",
            fontWeight: "bold",
            marginBottom: "12px"
          }}>
            {`Danh sách máy tại ${machineInfor?.location || '---'}`}
          </h5>

          {machines && machines.length > 0 ? (
            <ul className="list-unstyled m-0">
              {machines
                .filter((loc) => loc.location === machineInfor.location)
                .map((loc, index) => (
                  <li
                    key={index}
                    className="mb-1 animate-fadein"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <button
                      className="w-100 text-start d-block px-3 py-2 rounded border-0 bg-transparent menu-item"
                      style={{ fontSize: '14px' }}
                      onClick={() => {
                        navigate(`/machines/${loc.machine_id}`);
                        window.location.reload();
                      }}
                    >
                      {loc.machine_name}
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted px-3">Không có máy nào tại vị trí này.</p>
          )}
        </div>
      )} */}

      <MachineTreeSidebar
        machines={allLocations} // Tất cả máy
        machineInfor={machineInfor}
        navigate={navigate}
        width={width}
        selectedMachineId={machineInfor?.machine_id}
        dtGroup={dtGroup} // THÊM: Danh sách locations thuộc Duy Tân
        nonDtGroup={nonDtGroup} // THÊM: Danh sách locations thuộc Khác
      />

      {/* Main Content */}
      <div className="col px-0 py-0 mt-1 ms-1" style={{ 
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {/* Phần thông tin máy và cảnh báo */}
        <div className="row g-1 flex-shrink-0">
          {/* Cột ảnh máy */}
          <div className="col-12 col-md-6 col-lg-3">
            <div className="bg-white border rounded shadow w-100" style={{ 
              height: '227px', 
              overflow: 'hidden',
              maxHeight: '250px'
            }}>
              <img
                src={`${BASE_URL}${machineInfor.image_url}`}
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
                alt="Machine"
              />
            </div>
          </div>
          
          {/* Cột thông số máy */}
          <div className="col-12 col-md-6 col-lg-4">
            <div className="row g-1 mb-1">
              <div className="col-8">
                <div
                  className="border bg-white rounded text-center fw-semibold shadow d-flex flex-column justify-content-center text-dark"
                  style={{
                    height: '103px',
                    fontSize: 'clamp(18px, 3vw, 24px)',
                    letterSpacing: '0.5px',
                    padding: '0 12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowInforMachine(true)}
                  title={'Thông tin chi tiết'}
                >
                  <div style={{
                    whiteSpace: 'normal',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    textAlign: 'center',
                  }}>
                    {machineInfor?.machine_name || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="col-4">
                <div
                  className={`border rounded text-center fw-bold shadow d-flex align-items-center justify-content-center text-white 
                    ${isConnected(machineInfor.last_updated) ? getStatusClass(statusMachine?.status) : 'bg-warning text-dark'}`}
                  style={{ 
                    height: '103px', 
                    fontSize: 'clamp(14px, 2.5vw, 18px)',
                    padding: '8px'
                  }}
                >
                  <span style={{ wordBreak: 'break-word', textAlign: 'center' }}>
                    {isConnected(machineInfor.last_updated) ? convertStatusToString(statusMachine?.status) : 'Đang dừng'}
                  </span>
                </div>
              </div> 
                       
            </div>

            {/* Hàng thông số */}
            <div className="row g-1">
              <div className="col-4">
                <div className="border rounded text-center p-2 shadow d-flex flex-column bg-white" style={{ height: '120px' }}>
                  <p className="fw-semibold mb-2" style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(32, 64, 154, 1)' }}>
                    Hiệu suất
                  </p>
                  {paramMachine ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ height: '55px' }}>
                      <PerformanceChart performance={performanceMachine} />
                    </div>
                  ) : (
                    <h5 className="m-0 text-dark">N/A</h5>
                  )}
                </div>
              </div>

              <div className="col-4">
                <div className="border rounded text-center p-2 shadow d-flex flex-column bg-white" style={{ height: '120px' }}>
                  <p className="fw-semibold mb-0" style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(32, 64, 154, 1)' }}>
                    Số Shoot
                  </p>
                  <div className="flex-grow-1 d-flex align-items-center justify-content-center">
                    <h5 className="m-0 text-dark" style={{ fontSize: 'clamp(16px, 3vw, 20px)' }}>
                      {paramMachine ? shootMachine.toLocaleString('en-US') : 'N/A'}
                    </h5>
                  </div>
                </div>
              </div>

              <div className="col-4">
                <div className="border rounded text-center p-2 shadow d-flex flex-column bg-white" style={{ height: '120px' }}>
                  <p className="fw-semibold mb-0" style={{ fontSize: 'clamp(15px, 2vw, 16px)', color: 'rgba(32, 64, 154, 1)' }}>
                    Tổng thời gian chạy (giờ)
                  </p>
                  <div className="flex-grow-1 d-flex align-items-center justify-content-center">
                    <h5 className="m-0 text-dark" style={{ fontSize: 'clamp(16px, 3vw, 20px)' }}>
                      {paramMachine ? `${totalTimeOn}` : 'N/A'}
                    </h5>
                  </div>
                </div>
              </div>

            </div>
          </div>  

          {/* Cột danh sách cảnh báo */}
          <div className="col-12 col-lg-5">
            <div className="card shadow p-2 rounded" style={{ 
              height: '227px', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div className="d-flex justify-content-between align-items-center mb-2 flex-shrink-0">
                <h6 className="text-danger fw-bold mb-0" style={{ fontSize: 'clamp(14px, 2.5vw, 18px)' }}>
                  DANH SÁCH CẢNH BÁO
                </h6>
                <i
                  className="bi bi-eye-fill text-secondary"
                  style={{ cursor: 'pointer', fontSize: '18px' }}
                  title="Xem tất cả"
                  onClick={() => setShowAnalysisError(true)}
                />
              </div>

              <div className="flex-grow-1" style={{ overflowY: 'auto', overflowX: 'auto' }}>
                <table className="table table-sm table-bordered mb-0">
                  <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>                       
                      <th style={{ fontSize: 'clamp(12px, 2vw, 15px)', minWidth: '60px' }}>Mã</th>
                      <th style={{ fontSize: 'clamp(12px, 2vw, 15px)', minWidth: '150px' }}>Mô tả</th>
                      <th style={{ fontSize: 'clamp(12px, 2vw, 15px)', minWidth: '110px' }}>Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorsMachine?.length > 0 ? (
                      errorsMachine.map((err) => (
                        <tr key={err.id}>                           
                          <td style={{ fontSize: 'clamp(12px, 2vw, 15px)' }}>{err.alarm_id}</td>
                          <td style={{ fontSize: 'clamp(12px, 2vw, 15px)' }}>{err.alarm_name}</td>
                          <td style={{ fontSize: 'clamp(12px, 2vw, 15px)' }}>{new Date(err.timestamp).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="text-center text-muted" style={{ fontSize: 'clamp(11px, 2vw, 13px)' }}>
                          Không có lỗi
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>             
        </div>

        {/* Phần biểu đồ - FIXED */}
        <div className="row g-1 flex-grow-1" style={{ 
          minHeight: '400px',
          marginBottom: '8px'
        }}>
          {/* Chart 1 - Sản lượng */}
          <div className="col-12 col-xl-6 mb-0 mb-xl-0">
            <div className="card p-2 shadow d-flex flex-column h-100" style={{ 
              minHeight: '350px'
            }}>
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap flex-shrink-0" style={{ 
                color: '#203E9A', 
                fontWeight: 'bold', 
                fontSize: 'clamp(15px, 2.5vw, 18px)',
                gap: '8px'
              }}>
                <div>BIỂU ĐỒ SẢN LƯỢNG</div>
                <div
                  style={{ 
                    cursor: 'pointer', 
                    color: '#000080', 
                    fontWeight: '500', 
                    fontSize: 'clamp(15px, 2vw, 18px)',
                    textAlign: 'right'
                  }}
                  onClick={() => setShowTimeWindowChart1(true)}
                >
                  Thời gian: {fromDateChart1 && toDateChart1
                    ? `${fromDateChart1.toLocaleDateString('vi-VN')} → ${toDateChart1.toLocaleDateString('vi-VN')}`
                    : 'Chọn thời gian'}
                </div>
              </div>

              <div style={{ 
                flexGrow: 1, 
                minHeight: 0, 
                position: 'relative',
                width: '100%'
              }}>
                <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0,
                  padding: '4px'
                }}>
                  {viewModeChart1 === 'month' ? (
                    <BarChart labels={monthLabels} dataValues={productivityMonthDataValues}/>
                  ) : (
                    <BarChart labels={yearLabels} dataValues={productivityYearDataValues}/>
                  )}
                </div>
              </div>

              <div className="d-flex justify-content-between mt-2 flex-wrap flex-shrink-0" style={{ 
                fontSize: 'clamp(11px, 2vw, 14px)', 
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ fontWeight: 'bold', color: '#203E9A' }}>Sản lượng</div>
                <div className="d-flex gap-2 flex-wrap" style={{ color: 'orangered', fontWeight: 600 }}>
                  <div>min: {minValueProductivity.toFixed(1)}</div>
                  <div>max: {maxValueProductivity.toFixed(1)}</div>
                  <div>avg: {avgValueProductivity.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2 & 3 */}
          <div className="col-12 col-xl-6">
            <div className="d-flex flex-column h-100" style={{ gap: '4px' }}>
              {/* Chart 2 - Thời gian */}
              <div className="card p-2 shadow d-flex flex-column" style={{ 
                flex: '1 1 55%',
                minHeight: '250px',
                maxHeight: width < 1200 ? '350px' : 'none'
              }}>
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap flex-shrink-0" style={{ 
                  color: '#203E9A', 
                  fontWeight: 'bold', 
                  fontSize: 'clamp(15px, 2.5vw, 18px)',
                  gap: '8px'
                }}>
                  <div>BIỂU ĐỒ THỜI GIAN</div>
                  <div
                    style={{ 
                      cursor: 'pointer', 
                      color: '#000080', 
                      fontWeight: '500', 
                      fontSize: 'clamp(15px, 2vw, 18px)',
                      textAlign: 'right'
                    }}
                    onClick={() => setShowTimeWindowChart2(true)}
                  >
                    Thời gian: {fromDateChart2 && toDateChart2
                      ? `${fromDateChart2.toLocaleDateString('vi-VN')} → ${toDateChart2.toLocaleDateString('vi-VN')}`
                      : 'Chọn thời gian'}
                  </div>
                </div>

                <div style={{ 
                  flexGrow: 1, 
                  minHeight: 0, 
                  position: 'relative',
                  width: '100%'
                }}>
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0,
                    padding: '4px'
                  }}>
                    {viewModeChart2 === 'month' ? (
                      <BarLineChart_Sanluong labels={monthLabelsChart2} line1={timeErrorMonthDataValues} line2={timeStopMonthDataValues} line3={timeRunMonthDataValues}/>
                    ) : (
                      <BarLineChart_Sanluong labels={yearLabelsChart2} line1={timerErrorYearDataValues} line2={timerStopYearDataValues} line3={timerRunYearDataValues}/>
                    )}
                  </div>
                </div>

                <div className="d-flex justify-content-between mt-1 flex-wrap flex-shrink-0" style={{ 
                  fontSize: 'clamp(11px, 2vw, 14px)', 
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#203E9A' }}>Thời gian chạy (giờ)</div>
                  <div className="d-flex gap-2 flex-wrap" style={{ color: 'orangered', fontWeight: 600 }}>
                    <div>min: {minValueTimeRun.toFixed(1)}</div>
                    <div>max: {maxValueTimeRun.toFixed(1)}</div>
                    <div>avg: {avgValueTimeRun.toFixed(1)}</div>
                  </div>
                </div>
              </div>

              {/* Chart 3 - Trạng thái */}
              <div className="card p-2 shadow d-flex flex-column" style={{ 
                flex: '1 1 43%',
                minHeight: '158px',
                maxHeight: width < 1200 ? '300px' : 'none'
              }}>
                <div className="d-flex justify-content-between align-items-center mb-1 flex-shrink-0" style={{ 
                  color: '#203E9A', 
                  fontWeight: 'bold', 
                  fontSize: 'clamp(14px, 2.5vw, 18px)'
                }}>
                  <div>BIỂU ĐỒ TRẠNG THÁI</div>
                </div>

                <div style={{ 
                  flexGrow: 1, 
                  minHeight: 0, 
                  position: 'relative',
                  width: '100%'
                }}>
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0,
                    padding: '4px'
                  }}>
                    <BarChartStatus labels={labelsChart3} line1={statusDataValuesChart3}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>   
    </div>

    {/* Modal thông tin máy */}
    {showInforMachine && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
        overflowY: 'auto',
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '500px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          fontSize: '0.95rem',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <div className="d-flex justify-content-between align-items-center">
            <h5 style={{ margin: 0, color: '#203E9A', fontWeight: '600' }}>Thông tin máy</h5>
            <button className="btn-close" onClick={() => setShowInforMachine(false)} />
          </div>

          <hr />

          <div className="mt-1">
            <div className="row g-0 align-items-center">
              <div className="col-12 mb-3">
                <div className="fw-semibold mb-2">ID máy:</div>
                <div className="bg-light px-3 py-2 border rounded fw-normal">
                  {machineInfor.machine_id}
                </div>
              </div>

              {/* Trạng thái kết nối */}
              <div className="col-12 mb-3">
                <div className="fw-semibold mb-2">Trạng thái kết nối Wifi:</div>
                <div className="px-3 py-2 border rounded fw-normal d-flex align-items-center gap-2" style={{
                  backgroundColor: isConnected(machineInfor.last_updated) ? '#d1e7dd' : '#f8d7da',
                }}>
                  <span style={{
                    color: isConnected(machineInfor.last_updated) ? '#198754' : '#dc3545',
                    fontWeight: '500'
                  }}>
                    {isConnected(machineInfor.last_updated) ? '🟢 Đang kết nối' : '🔴 Mất kết nối'}
                  </span>
                </div>
              </div>

              <div className="col-12">
                <div className="fw-semibold mb-2">Thông tin khác:</div>
                <div className="bg-light px-3 py-2 border rounded text-start fw-normal" style={{
                  minHeight: '80px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}>
                  <table className="table table-sm table-bordered mb-0">
                    <tbody>
                      {machineInfor.information?.split("\n").filter(line => line.trim()).map((line, index) => {
                        const [key, value] = line.split(":");
                        return (
                          <tr key={index}>
                            <td className="fw-semibold" style={{ width: "40%" }}>{key?.trim()}</td>
                            <td>{value?.trim()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end mt-4 gap-2 flex-wrap">
            <button
              className="btn px-3 text-white fw-semibold"
              style={{ backgroundColor: 'rgba(32, 64, 154, 1)' }}
              onClick={() => handleBootData()}
            >
              🚀 Boot
            </button>
            <button className="btn btn-secondary px-4" onClick={() => setShowInforMachine(false)}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal phân tích lỗi */}
    {showAnalysisError && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '1rem',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, color: '#203E9A', fontWeight: '600' }}>Phân tích</h5>
            <button className="btn-close" onClick={() => setShowAnalysisError(false)} />
          </div>

          <hr style={{ margin: '12px 0' }}/>

          <div style={{ height: '400px', minHeight: '300px' }}>
            <BarChart_Error labels={labelsChartErr} dataValues={dataValuesChartErr} />
          </div>
        </div>
      </div>
    )}

    {/* Modal chọn thời gian Chart 1 */}
    {showTimeWindowChart1 && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '1rem',
          width: '90%',
          maxWidth: '480px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, color: '#203E9A' }}>🕒 Chọn khoảng thời gian</h5>
            <button className="btn-close" onClick={() => setShowTimeWindowChart1(false)} />
          </div>

          <hr />

          <div className="mt-3">
            <label className="form-label fw-semibold">Từ ngày:</label>
            <DatePicker
              selected={tempFromDateChart1}
              onChange={(date) => setTempFromDateChart1(date)}
              dateFormat="dd/MM/yyyy"
              className="form-control"
              placeholderText="Chọn ngày bắt đầu"
            />
          </div>

          <div className="mt-3">
            <label className="form-label fw-semibold">Đến ngày:</label>
            <DatePicker
              selected={tempToDateChart1}
              onChange={(date) => setTempToDateChart1(date)}
              dateFormat="dd/MM/yyyy"
              className="form-control"
              placeholderText="Chọn ngày kết thúc"
            />
          </div>

          <div className="mt-3">
            <label className="form-label fw-semibold">Hiển thị:</label>
            <select className="form-select" value={tempViewModeChart1} onChange={(e) => handleViewModeChart1Change(e.target.value)}>
              <option value="month">Từng ngày</option>
              <option value="year">Từng tháng</option>
            </select>
          </div>

          <div className="d-flex justify-content-end mt-4 gap-2 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={() => {
              handleCancelTimeChart1();
              setShowTimeWindowChart1(false);
            }}>Huỷ</button>
            <button className="btn btn-primary" onClick={() => {
              handleUpdateTimeChart1();
              setShowTimeWindowChart1(false);
            }}>Cập nhật</button>
          </div>
        </div>
      </div>
    )}

    {/* Modal chọn thời gian Chart 2 */}
    {showTimeWindowChart2 && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '1rem',
          width: '90%',
          maxWidth: '480px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, color: '#203E9A' }}>🕒 Chọn khoảng thời gian</h5>
            <button className="btn-close" onClick={() => setShowTimeWindowChart2(false)} />
          </div>

          <hr />

          <div className="mt-3">
            <label className="form-label fw-semibold">Từ ngày:</label>
            <DatePicker
              selected={tempFromDateChart2}
              onChange={(date) => setTempFromDateChart2(date)}
              dateFormat="dd/MM/yyyy"
              className="form-control"
              placeholderText="Chọn ngày bắt đầu"
            />
          </div>

          <div className="mt-3">
            <label className="form-label fw-semibold">Đến ngày:</label>
            <DatePicker
              selected={tempToDateChart2}
              onChange={(date) => setTempToDateChart2(date)}
              dateFormat="dd/MM/yyyy"
              className="form-control"
              placeholderText="Chọn ngày kết thúc"
            />
          </div>

          <div className="mt-3">
            <label className="form-label fw-semibold">Hiển thị:</label>
            <select className="form-select" value={tempViewModeChart2} onChange={(e) => handleViewModeChart2Change(e.target.value)}>
              <option value="month">Từng ngày</option>
              <option value="year">Từng tháng</option>
            </select>
          </div>

          <div className="d-flex justify-content-end mt-4 gap-2 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={() => {
              handleCancelTimeChart2();
              setShowTimeWindowChart2(false);
            }}>Huỷ</button>
            <button className="btn btn-primary" onClick={() => {
              handleUpdateTimeChart2();
              setShowTimeWindowChart2(false);
            }}>Cập nhật</button>
          </div>
        </div>
      </div>
    )}

    {/* Modal chọn thời gian Chart 3 */}
    {showTimeWindowChart3 && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '1rem',
          width: '90%',
          maxWidth: '480px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, color: '#203E9A' }}>🕒 Chọn khoảng thời gian</h5>
            <button className="btn-close" onClick={() => setShowTimeWindowChart3(false)} />
          </div>

          <hr />

          <div className="mt-3">
            <label className="form-label fw-semibold">Từ ngày:</label>
            <DatePicker
              selected={tempFromDateChart3}
              onChange={(date) => setTempFromDateChart3(date)}
              dateFormat="dd/MM/yyyy HH:mm"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              className="form-control"
              placeholderText="Chọn ngày bắt đầu"
            />
          </div>

          <div className="mt-3">
            <label className="form-label fw-semibold">Đến ngày:</label>
            <DatePicker
              selected={tempToDateChart3}
              onChange={(date) => setTempToDateChart3(date)}
              dateFormat="dd/MM/yyyy HH:mm"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              className="form-control"
              placeholderText="Chọn ngày kết thúc"
            />
          </div>

          <div className="d-flex justify-content-end mt-4 gap-2 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={() => {
              handleCancelTimeChart3();
              setShowTimeWindowChart3(false);
            }}>Huỷ</button>
            <button className="btn btn-primary" onClick={() => {
              handleUpdateTimeChart3();
              setShowTimeWindowChart3(false);
            }}>Cập nhật</button>
          </div>
        </div>
      </div>
    )}

    {/* Offcanvas cho mobile */}
    {width < 1200 && (
      <div
        className="offcanvas offcanvas-start"
        tabIndex="-1"
        id="offcanvasMachinesList"
        ref={offcanvasRef}
        style={{ width: '265px' }}
        aria-labelledby="offcanvasMachinesListLabel"
        data-bs-backdrop="static" 
        data-bs-keyboard="false"
      >
        {/* Header: thu nhỏ khoảng cách */}
        <div
          className="offcanvas-header py-1 px-2 mt-1"
          style={{ marginBottom: '-8px' }}
        >
          <button
            type="button"
            className="btn-close ms-auto"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
            style={{
              scale: '0.9', // nút nhỏ gọn hơn
            }}
          ></button>
        </div>

        {/* Body: sát lên hơn */}
        <div className="offcanvas-body px-2 pt-1" >
          <MachineTreeSidebarMobile
            machines={allLocations}
            machineInfor={machineInfor}
            navigate={navigate}
            width={width}
            selectedMachineId={machineInfor?.machine_id}
            dtGroup={dtGroup}
            nonDtGroup={nonDtGroup}
          />
        </div>
      </div>
    )}

    {isLoading && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )}

  </div>
    
  );
}

export default Machine;
