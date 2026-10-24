import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../auth";

// The once-per-load session refresh (and waking the idle server) now runs in the startup
// flow — see serverStatus.ts and StartupGate. Signed-in people are never blocked here.
function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default ProtectedRoute;
