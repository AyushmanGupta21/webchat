import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { connectDB } from "./src/server/db.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function warmUpDevelopmentRoutes(baseUrl) {
  if (!dev) return;

  const warmUpPaths = [
    "/",
    "/api/auth/check",
    "/api/messages/users",
    "/api/messages/00000000-0000-0000-0000-000000000000",
  ];

  await Promise.all(
    warmUpPaths.map(async (path) => {
      try {
        await fetch(`${baseUrl}${path}`, {
          method: "GET",
          headers: {
            "cache-control": "no-cache",
          },
        });
      } catch {
        // Ignore warm-up failures; this is a best-effort optimization.
      }
    })
  );

  console.log("> Dev routes warmed");
}

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);

      warmUpDevelopmentRoutes(`http://${hostname}:${port}`);

      // Warm DB connection in background so first paint is not blocked by DB init.
      connectDB()
        .then(() => {
          console.log("> Database connected");
        })
        .catch((error) => {
          console.error("Database initialization failed", error);
        });
    });
  })
  .catch((error) => {
    console.error("Failed to start Next.js server", error);
    process.exit(1);
  });
