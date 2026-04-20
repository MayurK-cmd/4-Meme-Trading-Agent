import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function useApi() {
  const { getAccessToken } = usePrivy();

  const request = useCallback(async (method, path, body) => {
    const token = await getAccessToken();
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }, [getAccessToken]);

  return {
    get:    useCallback((path) => request("GET", path, undefined), [request]),
    post:   useCallback((path, body) => request("POST", path, body), [request]),
    patch:  useCallback((path, body) => request("PATCH", path, body), [request]),
  };
}