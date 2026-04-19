"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SignUpPage from "@/features/auth/pages/SignUpPage";
import { useAuthStore } from "@/store/useAuthStore";

export default function SignupRoute() {
  const router = useRouter();
  const { authUser, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    if (!isCheckingAuth && authUser) {
      router.replace("/");
    }
  }, [authUser, isCheckingAuth, router]);

  if (authUser) return null;

  return <SignUpPage />;
}
