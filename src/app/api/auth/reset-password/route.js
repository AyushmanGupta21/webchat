import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { dbQuery } from "@/server/db.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const { email, newPassword, confirmPassword } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !newPassword || !confirmPassword) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ message: "Passwords do not match" }, { status: 400 });
    }

    const userResult = await dbQuery(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [
      normalizedEmail,
    ]);

    if (userResult.rowCount === 0) {
      return NextResponse.json({ message: "No account found for this email" }, { status: 404 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await dbQuery(
      `
        UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [hashedPassword, userResult.rows[0].id]
    );

    return NextResponse.json({ message: "Password reset successful" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
