import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import CategoriesModule from "./CategoriesModule";
import ImportCenter from "./ImportCenter";
import ExportCenter from "./ExportCenter";
import InventoryModule from "./InventoryModule.jsx";
import BOMModule from "./BOMModule";
import {apiFetch} from "../api.js";

export default function ProductModule({onNavigate}) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [attributes, setAttributes] = useState([{ key: "", value: "" }]);
  const [deletedItem, setDeletedItem] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "",
  });
  const [activeTab, setActiveTab] = useState("products");
  
  
  //  Fetch products
const fetchProducts = async () => {
  try {

    const data = await apiFetch("/api/products");

    setProducts(
      Array.isArray(data)
        ? data
        : []
    );

  } catch (err) {

    console.error("Fetch products error:", err);

    setProducts([]);
  }
};

  useEffect(() => {
    fetchProducts();
  }, []);
  
  const handleAttrChange = (index, field, value) => {
  const updated = [...attributes];
  updated[index][field] = value;
  setAttributes(updated);
  };
  //  Handle input change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const addAttribute = () => {
  setAttributes([...attributes, { key: "", value: "" }]);
};
  //  Submit product
const handleSubmit = async (e) => {
  e.preventDefault();

  const attrObject = {};
  attributes.forEach(attr => {
    if (attr.key) attrObject[attr.key] = attr.value;
  });

  const payload = {

    name: form.name,
    price: Number(form.price),
    stock: Number(form.stock),
    attributes: attrObject
  };

  // ONLY ONE API CALL
  if (editingProduct) {
    // UPDATE
    await apiFetch(`/api/products/${editingProduct}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    setEditingProduct(null);
  } else {
    // CREATE
    await apiFetch("/api/products/add", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  // reset form
  setForm({
    name: "",
    price: "",
    stock: ""
  });

  setAttributes([{ key: "", value: "" }]);

  setShowForm(false);
  fetchProducts();
};

   const handleDelete = async (product) => {
  // remove instantly from UI
  setProducts(products.filter(p => p.id !== product.id));

  setDeletedItem(product);

  // start 5 sec timer
  const timer = setTimeout(async () => {
    await apiFetch(`/api/products/${product.id}`,{
      method: "DELETE",
      credentials: "include"
    });
    setDeletedItem(null);
  }, 5000);

  setUndoTimer(timer);
};

 const handleUndo = () => {
  clearTimeout(undoTimer);
  setProducts([deletedItem, ...products]);
  setDeletedItem(null);
};

const handleEdit = (product) => {
  setForm({
    name: product.name,
    price: product.price,
    stock: product.stock
  });

  // convert attributes back
  const attrs = Object.entries(product.attributes || {}).map(
    ([key, value]) => ({ key, value })
  );

  setAttributes(attrs.length ? attrs : [{ key: "", value: "" }]);

  setEditingProduct(product.id);
  setShowForm(true);
};
  return (
    <div>
   <Link to="/" style={backButtonStyle}>
  ⬅ Back to Home
</Link>

<h2>Products Management</h2>

<div style={tabsContainer}>
  
  <button
    style={activeTab === "products" ? activeTabStyle : tabStyle}
    onClick={() => setActiveTab("products")}
  >
    Products
  </button>

  <button
    style={activeTab === "categories" ? activeTabStyle : tabStyle}
    onClick={() => setActiveTab("categories")}
  >
    Categories
  </button>

  <button
    style={activeTab === "inventory" ? activeTabStyle : tabStyle}
    onClick={() => setActiveTab("inventory")}
  >
    Inventory
  </button>

  <button
    style={activeTab === "import" ? activeTabStyle : tabStyle}
    onClick={() => setActiveTab("import")}
  >
    Import
  </button>

  <button
    style={activeTab === "export" ? activeTabStyle : tabStyle}
    onClick={() => setActiveTab("export")}
  >
    Export
  </button>

  <button
    style={activeTab === "bom" ? activeTabStyle : tabStyle}
    onClick={() => setActiveTab("bom")}
  >
    BOM
  </button>
</div>
{activeTab === "categories" && <CategoriesModule />}

{activeTab === "inventory" && <InventoryModule />}

{activeTab === "import" && <ImportCenter />}

{activeTab === "export" && <ExportCenter />}

{activeTab === "bom" && <BOMModule />}
     
      {activeTab === "products" && (
        <>
      <button
        onClick={() => setShowForm(!showForm)}
        style={addButtonStyle}
      > 
        {showForm ? "Close" : "+ Add Product"}
      </button>

        </>
)}
      {showForm && (
        <form onSubmit={handleSubmit} style={formStyle}>
          <h3>Add Product</h3>

          <input name="name" placeholder="Product Name" value={form.name} onChange={handleChange} required style={inputStyle} />
          <input name="price" type="number" placeholder="Price" value={form.price} onChange={handleChange} required style={inputStyle} />
          <input name="stock" type="number" placeholder="Stock" value={form.stock} onChange={handleChange} required style={inputStyle} />
          <h4>Custom Attributes</h4>

{attributes.map((attr, index) => (
  <div key={index} style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
    
    <input
      placeholder="Attribute (e.g. Size)"
      value={attr.key}
      onChange={(e) => handleAttrChange(index, "key", e.target.value)}
      style={{ ...inputStyle, flex: 1 }}
    />

    <input
      placeholder="Value (e.g. M)"
      value={attr.value}
      onChange={(e) => handleAttrChange(index, "value", e.target.value)}
      style={{ ...inputStyle, flex: 1 }}
    />

  </div>
))}

<button type="button" onClick={addAttribute} style={{ marginBottom: "10px" }}>
  + Add Attribute
</button>

          <button style={buttonStyle}>Add Product</button>
        </form>
      )}
    
       
      {products.length === 0 && <p>No products yet. Add one </p>}

 {products.length === 0 ? (
  <p>No products yet. Add one </p>
) : (
  <div style={{ overflowX: "auto", marginTop: "20px" }}>
    <table style={tableStyle}>
      <thead>
        <tr style={{ background: "#f3f4f6" }}>
          <th style={thStyle}>Name</th>
          <th style={thStyle}>Price</th>
          <th style={thStyle}>Stock</th>
          <th style={thStyle}>Attributes</th>
          <th style={thStyle}>Actions</th>
        </tr>
      </thead>
         {deletedItem && (
  <div style={undoStyle}>
    Product deleted
    <button onClick={handleUndo} style={undoBtn}>
      Undo
    </button>
  </div>
)}
      <tbody>
        
        {products.map((p) => (
          <tr key={p.id} style={trStyle}>
            <td style={tdStyle}>{p.name}</td>
            <td style={tdStyle}>₹{p.price}</td>
            <td style={tdStyle}>{p.stock}</td>

            <td style={tdStyle}>
              {p.attributes &&
                Object.entries(p.attributes).map(([k, v]) => (
                  <div key={k}>
                    <strong>{k}:</strong> {v}
                  </div>
                ))}
            </td>

            <td style={tdStyle}>
              <button onClick={() => handleEdit(p)} style={editBtn}>
               Edit
             </button>
              <button onClick={() => handleDelete(p)} style={deleteBtn}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
    </div>
  );
}

//  styles
const addButtonStyle = {
  background: "#d22d4b",
  color: "#fff",
  padding: "10px 16px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  marginBottom: "15px"
};

const formStyle = {
  border: "1px solid #e5e7eb",
  padding: "15px",
  borderRadius: "10px",
  marginBottom: "20px",
  background: "#fff"
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "8px",
  marginBottom: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd"
};

const buttonStyle = {
  background: "#d22d4b",
  color: "#fff",
  padding: "10px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  width: "100%"
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  padding: "10px",
  borderRadius: "8px",
  marginBottom: "10px",
  background: "#fff"
};
const backButtonStyle = {
  background: "#1f2937",
  color: "#fff",
  padding: "8px 14px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  marginBottom: "10px"
};
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
  borderRadius: "10px",
  overflow: "hidden"
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  fontWeight: "600",
  borderBottom: "1px solid #e5e7eb"
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e5e7eb"
};

const trStyle = {
  transition: "0.2s"
};

const editBtn = {
  background: "#1f2937",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  marginRight: "5px",
  borderRadius: "6px",
  cursor: "pointer"
};

const deleteBtn = {
  background: "#d22d4b",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};
const tabsContainer = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px",
  flexWrap: "wrap"
};

const tabStyle = {
  padding: "8px 16px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  cursor: "pointer",
  background: "#fff"
};

const activeTabStyle = {
  ...tabStyle,
  background: "#d22d4b",
  color: "#fff"
};

const undoStyle = {
  background: "#264653",
  color: "#fff",
  padding: "10px",
  borderRadius: "8px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between"
};

const undoBtn = {
  background: "#2A9D8F",
  border: "none",
  color: "#fff",
  padding: "5px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};