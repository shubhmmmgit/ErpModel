// src/api.js
const BASE_URL = import.meta.env.VITE_API_URL || "";

export const apiFetch = (path, options = {}) => {
  const { headers, ...rest } = options;
  return fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    ...rest
  });
};