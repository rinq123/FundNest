const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const errorMessage = data?.error ?? `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

export { API_BASE_URL };
