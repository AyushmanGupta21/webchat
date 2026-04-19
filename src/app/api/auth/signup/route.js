import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { dbQuery } from "@/server/db.js";
import { mapUserRowToApiUser, setAuthCookie, signToken } from "@/server/auth.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const { fullName, email, password, confirmPassword } = await request.json();

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    if (!fullName.trim()) {
      return NextResponse.json({ message: "Full name is required" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ message: "Passwords do not match" }, { status: 400 });
    }

    const existingUser = await dbQuery(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [
      normalizedEmail,
    ]);
    if (existingUser.rowCount > 0) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const savedUser = await dbQuery(
      `
        INSERT INTO users (full_name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, full_name, email, profile_pic, created_at
      `,
      [fullName.trim(), normalizedEmail, hashedPassword]
    );

    const apiUser = mapUserRowToApiUser(savedUser.rows[0]);

    const token = signToken(apiUser._id);
    const response = NextResponse.json(apiUser, { status: 201 });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
