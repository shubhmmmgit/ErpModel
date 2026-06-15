// src/Pages/ImportCenter.jsx

import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function ImportCenter() {
  const [entityType, setEntityType] = useState("products");
  const [file, setFile] = useState(null);

  const [previewData, setPreviewData] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ───────────────────────────────────────
  // LOAD HISTORY
  // ───────────────────────────────────────
  const loadHistory = async () => {
    try {
      const data = await apiFetch("/api/import/history");
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // ───────────────────────────────────────
  // DOWNLOAD TEMPLATE
  // ───────────────────────────────────────
  const downloadTemplate = () => {
    window.open(
      `${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/import/template/${entityType}`,
      "_blank"
    );
  };

  // ───────────────────────────────────────
  // PREVIEW FILE
  // ───────────────────────────────────────
  const handlePreview = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const formData = new FormData();

      formData.append("file", file);
      formData.append("entity_type", entityType);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/import/preview`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setPreviewData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────────────
  // CONFIRM IMPORT
  // ───────────────────────────────────────
  const confirmImport = async () => {
    try {
      if (!previewData) return;

      setImporting(true);
      setError("");

      const result = await apiFetch("/api/import/confirm", {
        method: "POST",
        body: JSON.stringify({
          entity_type: entityType,
          _payload: previewData._payload,
          file_name: previewData.file_name,
        }),
      });

      setMessage(
        `Imported ${result.success_rows} rows successfully`
      );

      setPreviewData(null);
      setFile(null);

      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            Import Center
          </h2>

          <p
            style={{
              color: "#6b7280",
              marginTop: "6px",
            }}
          >
            Import products, suppliers and customers
          </p>
        </div>

        <button
          onClick={downloadTemplate}
          style={{
            background: "#d22d4b",
            color: "#fff",
            border: "none",
            padding: "12px 18px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Download Template
        </button>
      </div>

      {/* Upload Card */}
      <div
        style={{
          background: "#fff",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,.08)",
        }}
      >
        <h3>Upload File</h3>

        <div
          style={{
            display: "grid",
            gap: "14px",
          }}
        >
          <select
            value={entityType}
            onChange={(e) =>
              setEntityType(e.target.value)
            }
            style={{
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            <option value="products">
              Products
            </option>

            <option value="suppliers">
              Suppliers
            </option>

            <option value="customers">
              Customers
            </option>
          </select>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) =>
              setFile(e.target.files[0])
            }
          />

          <button
            onClick={handlePreview}
            disabled={loading}
            style={{
              background: "#d22d4b",
              color: "#fff",
              border: "none",
              padding: "12px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {loading
              ? "Generating Preview..."
              : "Preview Import"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Preview */}
      {previewData && (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "24px",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.08)",
          }}
        >
          <h3>Preview</h3>

          <div
            style={{
              display: "flex",
              gap: "20px",
              marginBottom: "20px",
            }}
          >
            <span>
              Total Rows:
              <b>
                {" "}
                {previewData.total_rows}
              </b>
            </span>

            <span>
              Valid:
              <b
                style={{
                  color: "green",
                }}
              >
                {" "}
                {previewData.valid_rows}
              </b>
            </span>

            <span>
              Invalid:
              <b
                style={{
                  color: "red",
                }}
              >
                {" "}
                {previewData.invalid_rows}
              </b>
            </span>
          </div>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr>
                  {previewData.headers.map(
                    (header) => (
                      <th
                        key={header}
                        style={{
                          padding: "10px",
                          background:
                            "#f3f4f6",
                          textAlign:
                            "left",
                        }}
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {previewData.preview.map(
                  (row, index) => (
                    <tr key={index}>
                      {Object.values(
                        row
                      ).map(
                        (
                          value,
                          cellIndex
                        ) => (
                          <td
                            key={
                              cellIndex
                            }
                            style={{
                              padding:
                                "10px",
                              borderTop:
                                "1px solid #eee",
                            }}
                          >
                            {String(
                              value
                            )}
                          </td>
                        )
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={confirmImport}
            disabled={importing}
            style={{
              marginTop: "20px",
              background:
                "#16a34a",
              color: "#fff",
              border: "none",
              padding:
                "12px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {importing
              ? "Importing..."
              : "Confirm Import"}
          </button>
        </div>
      )}

      {/* History */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px",
          boxShadow:
            "0 2px 8px rgba(0,0,0,.08)",
        }}
      >
        <h3>Import History</h3>

        <table
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
          }}
        >
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Rows</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{item.file_name}</td>
                <td>
                  {item.entity_type}
                </td>
                <td>
                  {item.total_rows}
                </td>
                <td>
                  {item.success_rows}
                </td>
                <td>
                  {item.failed_rows}
                </td>
                <td>
                  {new Date(
                    item.created_at
                  ).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}