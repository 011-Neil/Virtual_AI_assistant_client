import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/start")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const response = await fetch("https://virtual-assitant-api.onrender.com/chat/start", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const text = await response.text();
            console.error("FastAPI error on /chat/start:", response.status, text);
            return new Response(
              JSON.stringify({ error: "Failed to reach the AI backend service" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const data = await response.json();
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("FastAPI /chat/start error:", e);
          return new Response(
            JSON.stringify({
              error: e instanceof Error ? e.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
