import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import Announcements from "./pages/Announcements";
import Attendance from "./pages/Attendance";
import AttendanceCongregation from "./pages/AttendanceCongregation";
import AttendanceLifeGroupDetail from "./pages/AttendanceLifeGroupDetail";
import AttendanceLifeGroups from "./pages/AttendanceLifeGroups";
import AttendanceWorkers from "./pages/AttendanceWorkers";
import Devotion from "./pages/Devotion";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import Login from "./pages/Login";
import People from "./pages/People";
import Reports from "./pages/Reports";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/devotion" element={<Devotion />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/people" element={<People />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance/workers" element={<AttendanceWorkers />} />
        <Route path="/attendance/congregation" element={<AttendanceCongregation />} />
        <Route path="/attendance/lifegroups" element={<AttendanceLifeGroups />} />
        <Route path="/attendance/lifegroups/:id" element={<AttendanceLifeGroupDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
