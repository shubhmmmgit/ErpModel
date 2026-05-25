// src/api.js
const BASE = import.meta.env.VITE_API_URL;

const api = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  return res;
};

export default api;