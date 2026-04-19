"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginPage from "@/features/auth/pages/LoginPage";
import { useAuthStore } from "@/store/useAuthStore";

export default function LoginRoute() {
  const router = useRouter();
  const { authUser, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    if (!isCheckingAuth && authUser) {
      router.replace("/");
    }
  }, [authUser, isCheckingAuth, router]);

  if (authUser) return null;

  return <LoginPage />;
}
