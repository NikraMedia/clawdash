import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `Du bist ein Reiseberater für die Ibiza-Gruppenreise 02.–08. Mai 2026 für 10 Personen.
Du kennst alle verfügbaren Airbnb-Listings und Flüge die auf der Seite angezeigt werden.
Empfiehl passende Unterkünfte, erstelle Favoritenlisten, beantworte Fragen zur Reise.
Sei freundlich, konkret und hilfreicher. Antworte auf Deutsch.
Budget-Hinweis: Die Preise sind Gesamtpreise für 6 Nächte für 10 Personen.`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN;
    const baseUrl = process.env.OPENAI_API_KEY
      ? "https://api.openai.com/v1"
      : "https://models.inference.ai.azure.com";
    const model = process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "gpt-4o-mini";

    if (!apiKey) {
      // Fallback: smart hardcoded responses
      const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
      let reply = "Hi! Ich bin dein Ibiza-Reiseberater 🌴 Stell mir Fragen zu Unterkünften, Budget oder der Reiseplanung!";

      if (lastMsg.includes("billig") || lastMsg.includes("günstig") || lastMsg.includes("budget")) {
        reply = "Für 10 Personen empfehle ich folgende günstigere Optionen (unter 5.000€ für 6 Nächte):\n\n• Privatunterkunft Santa Eulària – 2.784€ (Rating 5,0 ⭐)\n• Villa Sant Antoni – 2.953€ (Rating 4,80)\n• Privatunterkunft Sant Josep – 3.750€ (Rating 4,91)\n\nDas macht ~280–375€ pro Person für 6 Nächte. Sehr solide!";
      } else if (lastMsg.includes("villa") || lastMsg.includes("luxus")) {
        reply = "Top Villas mit bestem Rating:\n\n• Villa Es Cubells – 9.461€ (Rating 5,0 ⭐) – Traumlage\n• Villa Sant Josep – 6.459€ (Rating 5,0 ⭐)\n• Villa Santa Eulària – 7.805€ (Rating 5,0 ⭐)\n\nFür 10 Personen = ~646–946€ p.P. für 6 Nächte.";
      } else if (lastMsg.includes("wann") || lastMsg.includes("datum")) {
        reply = "Die Reise ist geplant: **02.–08. Mai 2026** (6 Nächte). Das ist perfekt – Ibiza im Mai ist noch nicht überfüllt, Preise günstiger als Juli/August, Wetter top (ca. 24°C).";
      } else if (lastMsg.includes("flug") || lastMsg.includes("fliegen")) {
        reply = "Flugdaten sind noch nicht geladen. Klick auf 'Flüge laden' um die Amadeus-Suche zu starten. Von Deutschland gibt es Direktflüge nach Ibiza (IBZ) ab ca. 80-200€ p.P. von Frankfurt, München, Berlin, Düsseldorf.";
      }

      return NextResponse.json({ reply });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Keine Antwort erhalten.";

    return NextResponse.json({ reply });
  } catch (e: unknown) {
    return NextResponse.json(
      { reply: "Entschuldigung, ich konnte keine Antwort generieren. Bitte versuch es nochmal.", error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  }
}
