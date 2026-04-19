import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { dbQuery } from "@/server/db.js";
import { mapUserRowToApiUser, setAuthCookie, signToken } from "@/server/auth.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const userResult = await dbQuery(
      `
        SELECT id, full_name, email, profile_pic, created_at, password_hash
        FROM users
        WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 400 });
    }

    const user = userResult.rows[0];

    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordCorrect) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 400 });
    }

    const apiUser = mapUserRowToApiUser(user);
    const token = signToken(apiUser._id);
    const response = NextResponse.json(apiUser, { status: 200 });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
