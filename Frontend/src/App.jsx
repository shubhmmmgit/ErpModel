import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Header from "./Components/Header";
import Footer from "./Components/Footer";
import Home from "./Pages/Home";
import ProductModule from "./Pages/ProductModule";
import OrderModule from "./Pages/OrderModule";
import CRMModule from "./Pages/CrmModule";
import PurchaseModule from "./Pages/Purchasemodule";
import Auth from "./Components/Auth";
import { apiFetch } from "./api";

// ── Private Route wrapper ─────────────────────────────────────
function PrivateRoute({ children, user, checking }) {
  if (checking) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:"60vh", color:"#64748b", fontSize:"15px" }}>
      Checking session…
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  const [user, setUser]       = useState(null);
  const [checking, setChecking] = useState(true);

  // ── On mount: verify session via cookie ────────────────────
  useEffect(() => {
    apiFetch("/api/auth/")
      .then(data => {
        setUser(data);
        localStorage.setItem("erpUser", JSON.stringify(data));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem("erpUser");
      })
      .finally(() => setChecking(false));
  }, []);

  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>
      <div style={{ flex:1, background:"#f9fafb", display:"flex",
        flexDirection:"column", minHeight:"100vh" }}>
        <Header />

        <div style={{ padding:"20px", flex:1 }}>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={
              user ? <Navigate to="/" replace /> : <Auth onLogin={setUser} />
            } />

            {/* Protected */}
            <Route path="/" element={
              <PrivateRoute user={user} checking={checking}>
                <Home user={user} setUser={setUser} />
              </PrivateRoute>
            } />
            <Route path="/products" element={
              <PrivateRoute user={user} checking={checking}>
                <ProductModule />
              </PrivateRoute>
            } />
            <Route path="/orders" element={
              <PrivateRoute user={user} checking={checking}>
                <OrderModule />
              </PrivateRoute>
            } />
            <Route path="/crm" element={
              <PrivateRoute user={user} checking={checking}>
                <CRMModule />
              </PrivateRoute>
            } />
            <Route path="/purchase" element={
              <PrivateRoute user={user} checking={checking}>
                <PurchaseModule />
              </PrivateRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </div>
  );
}