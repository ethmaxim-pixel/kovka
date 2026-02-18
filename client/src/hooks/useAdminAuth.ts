import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));

  const { data, isLoading } = trpc.auth.adminVerify.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false, refetchOnWindowFocus: false }
  );

  // If token is invalid, clean up
  useEffect(() => {
    if (token && data && !data.valid) {
      localStorage.removeItem("admin_token");
      setToken(null);
    }
  }, [token, data]);

  const login = useCallback((newToken: string) => {
    localStorage.setItem("admin_token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    setToken(null);
  }, []);

  return {
    isAuthenticated: !!token && !!data?.valid,
    isLoading: !!token && isLoading,
    username: data?.username ?? null,
    token,
    login,
    logout,
  };
}
