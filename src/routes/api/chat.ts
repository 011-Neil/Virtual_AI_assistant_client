import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are MediMind AI, a professional virtual health assistant that helps users understand possible conditions based on their symptoms.

Your role:
- Ask clear, structured follow-up questions (duration, severity, location, associated symptoms, age, medical history, medications) when needed.
- Based on reported symptoms, suggest 2-4 possible conditions ranked by likelihood, briefly explaining each.
- Provide a clear urgency level: 🟢 Self-care, 🟡 See a doctor soon, 🔴 Seek emergency care immediately.
- Suggest practical next steps, home care tips, and when to consult a professional.
- Use clean Markdown: short paragraphs, **bold** key terms, bullet lists, and headings when helpful.

Critical rules:
- You are NOT a doctor. Always include a brief disclaimer that this is informational only and not a medical diagnosis.
- If symptoms suggest a medical emergency (chest pain, difficulty breathing, stroke signs, severe bleeding, suicidal ideation, etc.), immediately advise calling local emergency services.
- Be warm, calm, and professional. Avoid alarming language unless an emergency is suspected.
- Never invent medications or dosages. Recommend consulting a pharmacist or physician for treatment.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as {
            messages: { role: "user" | "assistant"; content: string }[];
          };

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "AI gateway not configured" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const response = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: SYSTEM_PROMPT },
                  ...messages,
                ],
                stream: true,
              }),
            },
          );

          if (!response.ok) {
            if (response.status === 429) {
              return new Response(
                JSON.stringify({
                  error: "Too many requests. Please wait a moment and try again.",
                }),
                {
                  status: 429,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
            if (response.status === 402) {
              return new Response(
                JSON.stringify({
                  error:
                    "AI credits exhausted. Please add credits in Settings → Workspace → Usage.",
                }),
                {
                  status: 402,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
            const text = await response.text();
            console.error("AI gateway error:", response.status, text);
            return new Response(
              JSON.stringify({ error: "AI service error" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("chat error:", e);
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
