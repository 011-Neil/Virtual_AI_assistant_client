import React from "react";
import { createFileRoute } from "@tanstack/react-router";

const BACKEND = "https://virtual-assitant-api.onrender.com";

async function startConversation() {
  const response = await fetch(`${BACKEND}/chat/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to start conversation");
  }

  return response.json();
}

export const Route = createFileRoute("/api/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let { conversation_id, message } = await request.json();``

          if (!message) {
            return new Response(
              JSON.stringify({
                error: "Message is required",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // Automatically start a conversation if missing
          if (!conversation_id) {
            const start = await startConversation();
            conversation_id = start.conversation_id;
          }

          let response = await fetch(`${BACKEND}/chat/message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversation_id,
              message,
            }),
          });

          let data = await response.json();

          // If backend says invalid conversation, create a new one and retry once
          if (
            data.error &&
            data.error.toLowerCase().includes("invalid conversation")
          ) {
            const start = await startConversation();

            conversation_id = start.conversation_id;

            response = await fetch(`${BACKEND}/chat/message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                conversation_id,
                message,
              }),
            });

            data = await response.json();
          }

          const replyText = data.reply || "No reply received.";

          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();

              // Send conversation_id first so the client can save it
              controller.enqueue(
                encoder.encode(
                  `event: conversation\n` +
                    `data: ${JSON.stringify({
                      conversation_id,
                    })}\n\n`
                )
              );

              const tokens = replyText.split(/(\s+)/);

              for (const token of tokens) {
                if (!token) continue;

                const chunk = JSON.stringify({
                  choices: [
                    {
                      delta: {
                        content: token,
                      },
                    },
                  ],
                });

                controller.enqueue(
                  encoder.encode(`data: ${chunk}\n\n`)
                );

                await new Promise((r) => setTimeout(r, 20));
              }

              controller.enqueue(
                encoder.encode("data: [DONE]\n\n")
              );

              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (err) {
          console.error(err);

          return new Response(
            JSON.stringify({
              error:
                err instanceof Error
                  ? err.message
                  : "Unknown error",
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }
      },
    },
  },
});