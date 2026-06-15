// src/Pages/CategoriesModule.jsx

import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function CategoriesModule() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // ───────────────────────────────────────────
  // FETCH CATEGORIES
  // ───────────────────────────────────────────
  const loadCategories = async () => {
    try {
      setLoading(true);

      const data = await apiFetch("/api/categories");

      setCategories(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // ───────────────────────────────────────────
  // CREATE CATEGORY
  // ───────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Category name is required");
      return;
    }

    try {
      await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setForm({
        name: "",
        description: "",
      });

      await loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  // ───────────────────────────────────────────
  // DELETE CATEGORY
  // ───────────────────────────────────────────
  const deleteCategory = async (id) => {
    const confirmed = window.confirm(
      "Delete this category?"
    );

    if (!confirmed) return;

    try {
      await apiFetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      await loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  // ───────────────────────────────────────────
  // FILTER
  // ───────────────────────────────────────────
  const filtered = categories.filter((cat) =>
    cat.name?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h2
            style={{
              margin: 0,
              color: "#111827",
            }}
          >
            Categories
          </h2>

          <p
            style={{
              color: "#6b7280",
              marginTop: "4px",
            }}
          >
            Manage product categories
          </p>
        </div>

        <div
          style={{
            background: "#d22d4b",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: 600,
          }}
        >
          {categories.length} Categories
        </div>
      </div>

      {/* Add Category Card */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "20px",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            color: "#111827",
          }}
        >
          Add Category
        </h3>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr auto",
              gap: "12px",
            }}
          >
            <input
              type="text"
              placeholder="Category Name"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            />

            <input
              type="text"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            />

            <button
              type="submit"
              style={{
                background: "#d22d4b",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div
        style={{
          marginBottom: "16px",
        }}
      >
        <input
          type="text"
          placeholder="Search category..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            color: "red",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
            }}
          >
            Loading...
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead
              style={{
                background: "#f3f4f6",
              }}
            >
              <tr>
                <th
                  style={{
                    padding: "14px",
                    textAlign: "left",
                  }}
                >
                  Name
                </th>

                <th
                  style={{
                    padding: "14px",
                    textAlign: "left",
                  }}
                >
                  Description
                </th>

                <th
                  style={{
                    padding: "14px",
                    textAlign: "center",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="3"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    No categories found
                  </td>
                </tr>
              ) : (
                filtered.map((cat) => (
                  <tr
                    key={cat.id}
                    style={{
                      borderTop:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      {cat.name}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      {cat.description || "-"}
                    </td>

                    <td
                      style={{
                        textAlign: "center",
                        padding: "14px",
                      }}
                    >
                      <button
                        onClick={() =>
                          deleteCategory(cat.id)
                        }
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}