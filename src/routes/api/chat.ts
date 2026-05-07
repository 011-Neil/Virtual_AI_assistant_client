import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { conversation_id, message } = (await request.json()) as {
            conversation_id: string;
            message: string;
          };

          if (!conversation_id || !message) {
            return new Response(
              JSON.stringify({ error: "Missing conversation_id or message" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const response = await fetch("https://virtual-assitant-api.onrender.com/chat/message", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversation_id,
              message,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            console.error("FastAPI error on /chat/message:", response.status, text);
            return new Response(
              JSON.stringify({ error: "Failed to reach the AI backend service" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const data = await response.json();
          const replyText = data.reply || "No reply received.";

          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              const tokens = replyText.split(/(\s+)/); // split by whitespace but keep the whitespace

              for (const token of tokens) {
                if (!token) continue;
                const chunk = JSON.stringify({ choices: [{ delta: { content: token } }] });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                // Add a small delay to simulate streaming tokens
                await new Promise((r) => setTimeout(r, 20));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            },
          });
        } catch (e) {
          console.error("FastAPI /chat/message error:", e);
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
