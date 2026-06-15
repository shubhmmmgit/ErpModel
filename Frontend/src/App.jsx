import Header from "./Components/Header";
import Footer from "./Components/Footer";
import Sidebar from "./Components/SideBar";
import Home from "./Pages/Home";
import ProductModule from "./Pages/ProductModule";
import OrderModule from "./Pages/OrderModule";
import CRMModule from "./Pages/CrmModule";
import PurchaseModule from "./Pages/Purchasemodule";
import Auth from "./Components/Auth";
import { Routes, Route } from "react-router-dom";
import CategoriesModule from "./Pages/CategoriesModule";
import ImportCenter from "./Pages/ImportCenter";
import ExportCenter from "./Pages/ExportCenter";  
import BOMModule from "./Pages/BOMModule";


export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh"}}>
      
      {/* Optional Sidebar */}
      {/* <Sidebar /> */}

      <div style={{ flex: 1, background: "#f9fafb", display: "flex",
    flexDirection: "column",
    minHeight: "100vh" }}>
        <Header />

        <div style={{ padding: "20px", flex: 1  }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductModule />} />
            <Route path="/orders" element={<OrderModule />} />
            <Route path="/crm" element={<CRMModule />} />
            <Route path="/purchase" element={<PurchaseModule />} />
            <Route path="/auth" element={<Auth />} />
        
          </Routes>
        </div>

        <Footer />
      </div>
    </div>
  );
}