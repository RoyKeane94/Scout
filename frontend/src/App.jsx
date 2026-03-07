import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import RegisterOrg from './pages/RegisterOrg';
import Join from './pages/Join';
import Login from './pages/Login';
import Log from './pages/Log';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
/* Styles loaded via index.css */

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Header />
        <main className="app-main">
          <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<RegisterOrg />} />
        <Route path="/join" element={<Join />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/log"
          element={
            <ProtectedRoute>
              <Log />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
    </AuthProvider>
  );
}
