import Header from "./Components/Header";
import Footer from "./Components/Footer";
import Sidebar from "./Components/SideBar";

import Home from "./Pages/Home";
import ProductModule from "./Pages/ProductModule";
import OrderModule from "./Pages/OrderModule";
import CRMModule from "./Pages/CrmModule";
import PurchaseModule from "./Pages/PurchaseModule";

import Auth from "./Components/Auth";

import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <div style={{ display: "flex" }}>
      
      {/* Optional Sidebar */}
      {/* <Sidebar /> */}

      <div style={{ flex: 1, background: "#f9fafb" }}>
        <Header />

        <div style={{ padding: "20px" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductModule />} />
            <Route path="/orders" element={<OrderModule />} />
            <Route path="/crm" element={<CRMModule />} />

            {/* ── PURCHASE MODULE ── */}
            <Route path="/purchase" element={<PurchaseModule />} />

            <Route path="/auth" element={<Auth />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </div>
  );
}