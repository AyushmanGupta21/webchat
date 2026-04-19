import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/server/auth.js";

export async function POST() {
  try {
    const response = NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
