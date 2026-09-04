import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import Announcements from "./pages/Announcements";
import Devotion from "./pages/Devotion";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Members from "./pages/Members";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/devotion" element={<Devotion />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/members" element={<Members />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
