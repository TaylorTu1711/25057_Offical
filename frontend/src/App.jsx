
import HomePage from "./pages/HomePage.jsx";
import { Routes, Route, Navigate } from "react-router-dom";
import Machine from "./pages/Machine copy.jsx";
import ProtectedRoute from './components/ProtectedRoute';
import MidaPortalRoute, { DefaultPortalRoute } from './components/MidaPortalRoute';
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import MidaCncDashboard from "./pages/mida/MidaCncDashboard.jsx";
import MidaCncMachineDetail from "./pages/mida/MidaCncMachineDetail.jsx";
import 'react-datepicker/dist/react-datepicker.css';

function App() {
  return (
    <div className="min-h-screen app-shell transition-colors duration-300">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<DefaultPortalRoute><HomePage /></DefaultPortalRoute>} />
        <Route path="/machines/:machine_id" element={<ProtectedRoute><Machine /></ProtectedRoute>} />
        <Route path="/mida/cnc" element={<MidaPortalRoute><MidaCncDashboard /></MidaPortalRoute>} />
        <Route path="/mida/cnc/:machine_id" element={<MidaPortalRoute><MidaCncMachineDetail /></MidaPortalRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
