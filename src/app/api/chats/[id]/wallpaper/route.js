import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { getPusherServer } from "@/server/pusher.js";
import { areUsersFriends } from "@/server/friends.js";
import { CHAT_EVENTS, getUserChannelName } from "@/lib/realtime.js";

function getPair(userId, peerId) {
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

function normalizeWallpaperRow(row, currentUserId) {
  if (!row) return null;

  return {
    wallpaperUrl: row.wallpaperUrl,
    blurEnabled: row.blurEnabled,
    dimming: row.dimming,
    scope: row.ownerId ? "personal" : "shared",
    ownerId: row.ownerId,
    updatedBy: row.updatedBy,
    isMine: row.ownerId === currentUserId,
    updatedAt: row.updatedAt,
  };
}

async function getEffectiveWallpaper(userAId, userBId, currentUserId) {
  const wallpaperResult = await dbQuery(
    `
      SELECT
        owner_id AS "ownerId",
        wallpaper_url AS "wallpaperUrl",
        blur_enabled AS "blurEnabled",
        dimming,
        updated_by AS "updatedBy",
        updated_at AS "updatedAt"
      FROM chat_wallpapers
      WHERE user_a_id = $1
        AND user_b_id = $2
        AND (owner_id = $3 OR owner_id IS NULL)
      ORDER BY
        CASE WHEN owner_id = $3 THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1
    `,
    [userAId, userBId, currentUserId]
  );

  return normalizeWallpaperRow(wallpaperResult.rows[0] || null, currentUserId);
}

export async function GET(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { id: peerId } = await params;
    if (!peerId) {
      return NextResponse.json({ error: "Peer user id is required" }, { status: 400 });
    }

    const isFriend = await areUsersFriends(user._id, peerId);
    if (!isFriend) {
      return NextResponse.json({ error: "Wallpaper can be set only for friends" }, { status: 403 });
    }

    const [userAId, userBId] = getPair(user._id, peerId);
    const wallpaper = await getEffectiveWallpaper(userAId, userBId, user._id);

    return NextResponse.json({ wallpaper }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { id: peerId } = await params;
    if (!peerId) {
      return NextResponse.json({ error: "Peer user id is required" }, { status: 400 });
    }

    const isFriend = await areUsersFriends(user._id, peerId);
    if (!isFriend) {
      return NextResponse.json({ error: "Wallpaper can be set only for friends" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const wallpaperUrl = String(payload?.wallpaperUrl || "").trim();
    const scope = String(payload?.scope || "personal").toLowerCase() === "shared" ? "shared" : "personal";
    const blurEnabled = Boolean(payload?.blurEnabled);
    const dimming = Math.max(0, Math.min(80, Number.parseInt(String(payload?.dimming ?? 20), 10) || 20));

    if (!wallpaperUrl || !/^https?:\/\//i.test(wallpaperUrl)) {
      return NextResponse.json({ error: "A valid wallpaper URL is required" }, { status: 400 });
    }

    const [userAId, userBId] = getPair(user._id, peerId);

    if (scope === "shared") {
      const updateResult = await dbQuery(
        `
          UPDATE chat_wallpapers
          SET wallpaper_url = $3,
              blur_enabled = $4,
              dimming = $5,
              updated_by = $6,
              updated_at = NOW()
          WHERE user_a_id = $1
            AND user_b_id = $2
            AND owner_id IS NULL
          RETURNING id
        `,
        [userAId, userBId, wallpaperUrl, blurEnabled, dimming, user._id]
      );

      if (updateResult.rowCount === 0) {
        await dbQuery(
          `
            INSERT INTO chat_wallpapers (
              user_a_id,
              user_b_id,
              owner_id,
              wallpaper_url,
              blur_enabled,
              dimming,
              updated_by
            )
            VALUES ($1, $2, NULL, $3, $4, $5, $6)
          `,
          [userAId, userBId, wallpaperUrl, blurEnabled, dimming, user._id]
        );
      }
    } else {
      await dbQuery(
        `
          INSERT INTO chat_wallpapers (
            user_a_id,
            user_b_id,
            owner_id,
            wallpaper_url,
            blur_enabled,
            dimming,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_a_id, user_b_id, owner_id)
          DO UPDATE SET
            wallpaper_url = EXCLUDED.wallpaper_url,
            blur_enabled = EXCLUDED.blur_enabled,
            dimming = EXCLUDED.dimming,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `,
        [userAId, userBId, user._id, wallpaperUrl, blurEnabled, dimming, user._id]
      );
    }

    const wallpaper = await getEffectiveWallpaper(userAId, userBId, user._id);

    if (scope === "shared") {
      const pusherServer = getPusherServer();
      if (pusherServer) {
        try {
          await pusherServer.trigger(getUserChannelName(peerId), CHAT_EVENTS.WALLPAPER_UPDATED, {
            peerUserId: user._id,
            wallpaper,
          });
        } catch {
          // Shared wallpaper save should still succeed without realtime.
        }
      }
    }

    return NextResponse.json({ wallpaper }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
