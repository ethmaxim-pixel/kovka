import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "user";
  fallbackPath?: string;
}

/**
 * ProtectedRoute - Protects routes based on authentication and role
 * Redirects to fallbackPath if user doesn't have required access
 */
export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = "/",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Redirect to={fallbackPath} />;
  }

  // Redirect if role doesn't match
  if (requiredRole && user.role !== requiredRole) {
    return <Redirect to={fallbackPath} />;
  }

  return <>{children}</>;
}
