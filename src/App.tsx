import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import Announcements from "./pages/Announcements";
import Attendance from "./pages/Attendance";
import AttendanceCongregation from "./pages/AttendanceCongregation";
import AttendanceHeadcount from "./pages/AttendanceHeadcount";
import AttendanceLifeGroups from "./pages/AttendanceLifeGroups";
import AttendanceWorkers from "./pages/AttendanceWorkers";
import Devotion from "./pages/Devotion";
import DevModalsDemo from "./pages/DevModalsDemo";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import Login from "./pages/Login";
import PeopleCongregation from "./pages/PeopleCongregation";
import PeopleWorkers from "./pages/PeopleWorkers";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import ReportsCongregation from "./pages/ReportsCongregation";
import ReportsDevotions from "./pages/ReportsDevotions";
import ReportsLifeGroups from "./pages/ReportsLifeGroups";
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
        <Route path="/people" element={<Navigate to="/people/workers" replace />} />
        <Route path="/people/workers" element={<PeopleWorkers />} />
        <Route path="/people/congregation" element={<PeopleCongregation />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/congregation" element={<ReportsCongregation />} />
        <Route path="/reports/lifegroups" element={<ReportsLifeGroups />} />
        <Route path="/reports/devotions" element={<ReportsDevotions />} />
        <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
        <Route path="/settings/:tab" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance/workers" element={<AttendanceWorkers />} />
        <Route path="/attendance/congregation" element={<AttendanceCongregation />} />
        <Route path="/attendance/headcount" element={<AttendanceHeadcount />} />
        <Route path="/attendance/lifegroups" element={<AttendanceLifeGroups />} />
        {/* Not linked from navigation — a preview of the Modal/Toast/useConfirm system. */}
        <Route path="/dev/modals" element={<DevModalsDemo />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
