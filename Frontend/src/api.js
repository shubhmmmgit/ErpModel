// src/api.js

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const apiFetch = async (path, options = {}) => {
  try {
    const { headers, ...rest } = options;

    const response = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      ...rest
    });

    // Check if response is JSON
    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();

      console.error("NON JSON RESPONSE:", text);

      throw new Error("Server returned invalid response");
    }

    const data = await response.json();

    // Handle auth failures
    if (response.status === 401) {

      localStorage.removeItem("erpUser");

      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }

      throw new Error(data.error || "Unauthorised");
    }

    // Handle other API errors
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;

  } catch (err) {

    console.error("API ERROR:", err);

    throw err;
  }
};