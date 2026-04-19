import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import cloudinary from "@/server/cloudinary.js";

const ALLOWED_RESOURCE_TYPES = new Set(["auto", "image", "video"]);

export async function POST(request) {
  try {
    const { response } = await requireAuth(request);
    if (response) return response;

    const payload = await request.json().catch(() => ({}));
    const requestedResourceType = String(payload?.resourceType || "auto").toLowerCase();
    const resourceType = ALLOWED_RESOURCE_TYPES.has(requestedResourceType)
      ? requestedResourceType
      : "auto";

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Cloudinary is not configured" }, { status: 500 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "chat-media";
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);

    return NextResponse.json(
      {
        timestamp,
        signature,
        apiKey,
        cloudName,
        folder,
        resourceType,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to prepare media upload" }, { status: 500 });
  }
}