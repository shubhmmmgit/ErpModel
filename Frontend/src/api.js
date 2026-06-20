// src/api.js
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const apiFetch = async (path, options = {}) => {
  try {
    const { headers, ...rest } = options;

    // Attach token from localStorage if present
    const token = localStorage.getItem("erpToken");
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...headers,
      },
      ...rest,
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("NON JSON RESPONSE:", text);
      throw new Error("Server returned invalid response");
    }

    const data = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("erpToken");
      localStorage.removeItem("erpUser");
      if (!path.includes("/auth/me") && window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
      throw new Error(data.error || "Unauthorised");
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
};