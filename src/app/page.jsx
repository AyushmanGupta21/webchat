"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import HomePage from "@/features/chat/pages/HomePage";
import { useAuthStore } from "@/store/useAuthStore";

export default function HomeRoute() {
  const router = useRouter();
  const { authUser, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    if (!isCheckingAuth && !authUser) {
      router.replace("/login");
    }
  }, [authUser, isCheckingAuth, router]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="h-screen pt-20 flex items-center justify-center">
        <Loader className="size-6 animate-spin text-base-content/70" />
      </div>
    );
  }

  if (!authUser) return null;

  return <HomePage />;
}
