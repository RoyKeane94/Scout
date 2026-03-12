import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Privacy from './pages/Privacy';
import RegisterOrg from './pages/RegisterOrg';
import Join from './pages/Join';
import Login from './pages/Login';
import LogChoice from './pages/LogChoice';
import Log from './pages/Log';
import LogGap from './pages/LogGap';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Error from './pages/Error';
/* Styles loaded via index.css */

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="app-shell">
            <Header />
            <main className="app-main">
              <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/register" element={<RegisterOrg />} />
              <Route path="/join" element={<Join />} />
              <Route path="/login" element={<Login />} />
        <Route
          path="/log"
          element={
            <ProtectedRoute>
              <LogChoice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log/sighting"
          element={
            <ProtectedRoute>
              <Log />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log/gap"
          element={
            <ProtectedRoute>
              <LogGap />
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
                <Route path="/error" element={<Error />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
