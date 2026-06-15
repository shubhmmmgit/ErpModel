// src/Pages/ExportCenter.jsx

import { useState } from "react";

export default function ExportCenter() {
  const [loading, setLoading] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080";

  const exportData = async (
    endpoint,
    filename
  ) => {
    try {
      setLoading(filename);

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error =
          await response.json();

        throw new Error(
          error.error || "Export failed"
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(blob);

      const a =
        document.createElement("a");

      a.href = url;
      a.download = `${filename}.xlsx`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(
        url
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading("");
    }
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow:
      "0 4px 14px rgba(0,0,0,0.08)",
    cursor: "pointer",
    transition: "0.3s",
  };

  return (
    <div
      style={{
        padding: "24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: "28px",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#111827",
          }}
        >
          Export Center
        </h2>

        <p
          style={{
            color: "#6b7280",
            marginTop: "6px",
          }}
        >
          Export ERP data into Excel
          files
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(280px,1fr))",
          gap: "20px",
        }}
      >
        {/* Products */}
        <div
          style={cardStyle}
          onClick={() =>
            exportData(
              "/api/export/products",
              "products"
            )
          }
        >
          <h3>📦 Products</h3>

          <p
            style={{
              color: "#6b7280",
            }}
          >
            Export all products,
            pricing and stock data.
          </p>

          <button
            disabled={
              loading === "products"
            }
            style={buttonStyle}
          >
            {loading === "products"
              ? "Exporting..."
              : "Export Products"}
          </button>
        </div>

        {/* Inventory */}
        <div
          style={cardStyle}
          onClick={() =>
            exportData(
              "/api/export/inventory",
              "inventory"
            )
          }
        >
          <h3>📊 Inventory</h3>

          <p
            style={{
              color: "#6b7280",
            }}
          >
            Export inventory
            movement history and
            valuation.
          </p>

          <button
            disabled={
              loading === "inventory"
            }
            style={buttonStyle}
          >
            {loading === "inventory"
              ? "Exporting..."
              : "Export Inventory"}
          </button>
        </div>

        {/* Suppliers */}
        <div
          style={cardStyle}
          onClick={() =>
            exportData(
              "/api/export/suppliers",
              "suppliers"
            )
          }
        >
          <h3>🏭 Suppliers</h3>

          <p
            style={{
              color: "#6b7280",
            }}
          >
            Export supplier
            directory and contact
            details.
          </p>

          <button
            disabled={
              loading === "suppliers"
            }
            style={buttonStyle}
          >
            {loading === "suppliers"
              ? "Exporting..."
              : "Export Suppliers"}
          </button>
        </div>

        {/* Customers */}
        <div
          style={cardStyle}
          onClick={() =>
            exportData(
              "/api/export/customers",
              "customers"
            )
          }
        >
          <h3>👥 Customers</h3>

          <p
            style={{
              color: "#6b7280",
            }}
          >
            Export customer
            records and CRM data.
          </p>

          <button
            disabled={
              loading === "customers"
            }
            style={buttonStyle}
          >
            {loading === "customers"
              ? "Exporting..."
              : "Export Customers"}
          </button>
        </div>

        {/* Purchase Orders */}
        <div
          style={cardStyle}
          onClick={() =>
            exportData(
              "/api/export/purchase-orders",
              "purchase-orders"
            )
          }
        >
          <h3>🧾 Purchase Orders</h3>

          <p
            style={{
              color: "#6b7280",
            }}
          >
            Export purchase order
            history and supplier
            transactions.
          </p>

          <button
            disabled={
              loading ===
              "purchase-orders"
            }
            style={buttonStyle}
          >
            {loading ===
            "purchase-orders"
              ? "Exporting..."
              : "Export Purchase Orders"}
          </button>
        </div>
      </div>

      {/* Info Panel */}
      <div
        style={{
          marginTop: "30px",
          background: "#fff",
          borderRadius: "16px",
          padding: "20px",
          boxShadow:
            "0 4px 14px rgba(0,0,0,0.08)",
        }}
      >
        <h3>
          Export Information
        </h3>

        <ul
          style={{
            color: "#6b7280",
            lineHeight: "1.8",
          }}
        >
          <li>
            Exports are restricted
            to your own business
            data.
          </li>

          <li>
            Files are downloaded
            in Excel (.xlsx)
            format.
          </li>

          <li>
            Supports products,
            inventory, suppliers,
            customers and purchase
            orders.
          </li>

          <li>
            Large datasets may
            take a few seconds to
            generate.
          </li>
        </ul>
      </div>
    </div>
  );
}

const buttonStyle = {
  marginTop: "12px",
  background: "#d22d4b",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600,
};