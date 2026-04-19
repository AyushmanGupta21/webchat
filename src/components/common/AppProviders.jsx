"use client";

import { useEffect, useRef } from "react";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";

export default function AppProviders({ children }) {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const didRunCheckRef = useRef(false);

  useEffect(() => {
    if (didRunCheckRef.current) return;
    didRunCheckRef.current = true;
    checkAuth();
  }, [checkAuth]);

  return (
    <div data-theme={theme}>
      <Navbar />
      {children}
      {isCheckingAuth && !authUser && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-base-300 bg-base-100/90 px-3 py-2 shadow">
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <Loader className="size-4 animate-spin" />
            Checking session...
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
