import Header from "./Components/Header";
import Footer from "./Components/Footer";
import Sidebar from "./Components/SideBar";
import Home from "./Pages/Home";
import ProductModule from "./Pages/ProductModule";
import Auth from "./Components/Auth";
import OrderModule from "./Pages/OrderModule";
import { Routes, Route } from "react-router-dom";
import CRMModule from "./Pages/CrmModule"; 

export default function App() {
  return (
    <div style={{ display: "flex" }}>
      
     

      <div style={{ flex: 1, background: "#f9fafb" }}>
        <Header />

        <div style={{ padding: "20px" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductModule />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/orders" element={<OrderModule />} />
            <Route path="/crm" element={<CRMModule />} />

          </Routes>
        </div>

        <Footer />
      </div>
    </div>
  );
}