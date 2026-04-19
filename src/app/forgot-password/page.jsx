"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const { authUser, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    if (!isCheckingAuth && authUser) {
      router.replace("/");
    }
  }, [authUser, isCheckingAuth, router]);

  if (authUser) return null;

  return <ForgotPasswordPage />;
}
