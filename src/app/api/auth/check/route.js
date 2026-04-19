import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  return NextResponse.json(user, { status: 200 });
}
