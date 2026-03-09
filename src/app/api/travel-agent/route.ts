import { NextResponse } from "next/server";

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist ein universeller Travel Agent AI. Du hilfst Nutzern bei der Reiseplanung für beliebige Destinationen.

SICHERHEITS-GRENZEN (absolut):
- Du hast KEINEN Zugriff auf persönliche Daten, Emails, Kalender, Finanzdaten oder andere private Informationen.
- Du antwortest NUR zu Reisethemen: Unterkünfte, Flüge, Aktivitäten, Reisetipps, Packlisten, Budgetplanung.
- Bei Fragen außerhalb des Reisethemas: "Ich bin nur für Reiseplanung zuständig."
- Kein Zugriff auf externe Systeme außer den bereitgestellten Reisedaten.

FÄHIGKEITEN:
1. Airbnb-Suchen analysieren und empfehlen
2. Flugdaten interpretieren und vergleichen
3. Preis-Leistungs-Empfehlungen geben ("Das beste Angebot ist X weil...")
4. Favoritenlisten im Chat erstellen
5. Reisetipps: beste Viertel, Restaurants, Aktivitäten, Transport
6. Budgetplanung: Gesamtkosten für Gruppe berechnen
7. Reisezeitraum-Empfehlungen (Saison, Preise, Wetter)

KOMMUNIKATION:
- Freundlich, konkret, enthusiastisch
- Immer konkrete Empfehlungen geben, nicht nur Optionen auflisten
- Bei Gruppen: Preise pro Person UND gesamt nennen
- Antworte auf Deutsch
- Nutze Emojis sparsam aber effektiv

DATEN-INTEGRATION:
Wenn Flugdaten im Kontext sind, analysiere und vergleiche sie.
Wenn Airbnb-Links im Kontext sind, erkläre und empfehle.
Wenn der Nutzer "suche Flüge" oder "finde Airbnb" sagt — erkläre dass du die Suche starten kannst wenn er auf den Such-Button klickt oder die Parameter nennt.`;

// ─── LLM Call ────────────────────────────────────────────────────────────────
async function callLLM(messages: { role: string; content: string }[], systemExtra?: string) {
  const apiKey = process.env.GITHUB_TOKEN;
  if (!apiKey) {
    return "Ich bin dein Travel Agent! Nenn mir Destination, Datum und Personenzahl — ich helfe dir beim Planen. 🌍";
  }

  const fullSystem = SYSTEM_PROMPT + (systemExtra ? "\n\n" + systemExtra : "");

  const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: fullSystem },
        ...messages,
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`LLM error ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "Keine Antwort.";
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte warte eine Minute." }, { status: 429 });
  }

  let body: {
    messages: { role: string; content: string }[];
    context?: {
      destination?: string;
      checkin?: string;
      checkout?: string;
      guests?: number;
      flights?: object;
      airbnbUrl?: string;
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 3000) }));

  if (!messages.length) {
    return NextResponse.json({
      reply: "Hallo! Ich bin dein Travel Agent 🌍✈️\n\nNenn mir deine Wunschdestination, die Reisedaten und wie viele Personen — ich helfe dir mit Unterkünften, Flügen und allem drum herum!",
    });
  }

  // Build context string from current search state
  let contextStr = "";
  if (body.context) {
    const c = body.context;
    const parts: string[] = [];
    if (c.destination) parts.push(`Aktuelle Suche: ${c.destination}`);
    if (c.checkin && c.checkout) parts.push(`Zeitraum: ${c.checkin} bis ${c.checkout}`);
    if (c.guests) parts.push(`Personen: ${c.guests}`);
    if (c.airbnbUrl) parts.push(`Airbnb-Suche URL: ${c.airbnbUrl}`);
    if (c.flights) {
      const f = c.flights as { flights?: { price: number; carrier: string; departure: string; stops: number }[]; error?: string };
      if (f.flights && f.flights.length > 0) {
        const flightLines = f.flights.map((fl, i) => {
          const dep = fl.departure ? new Date(fl.departure).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "?";
          return `  ${i + 1}. ${fl.carrier} | ab ${fl.price.toFixed(0)}€/Person | Abflug: ${dep} | ${fl.stops === 0 ? "Direktflug" : fl.stops + " Stopp(s)"}`;
        }).join("\n");
        parts.push(`Aktuelle Flugdaten:\n${flightLines}`);
      } else if (f.error) {
        parts.push(`Flugsuche Fehler: ${f.error}`);
      }
    }
    if (parts.length) contextStr = "AKTUELLER SUCHKONTEXT:\n" + parts.join("\n");
  }

  try {
    const reply = await callLLM(messages, contextStr || undefined);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[travel-agent] error:", e instanceof Error ? e.message : e);
    return NextResponse.json({
      reply: "Kurzer technischer Fehler. Bitte nochmal versuchen! 🙏",
    });
  }
}
