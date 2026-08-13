const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error((await response.text()) || `API request failed (${response.status})`);
  return response.status === 204 ? undefined as T : response.json();
}
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, value: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(value) }),
  put: <T>(path: string, value: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(value) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
export const dataProvider = import.meta.env.VITE_DATA_PROVIDER === "api" ? "api" : "local";
