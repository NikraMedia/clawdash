import { NextResponse } from "next/server";

// ─── Rate Limiting (in-memory, per IP) ──────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── Ibiza Listings (hardcoded from markdown data) ──────────────────────────
const IBIZA_LISTINGS = `
Verfügbare Ibiza Unterkünfte (02.-08. Mai 2026, 6 Nächte, 10 Personen):

1. Villa Es Cubells – 9.461€ gesamt (~946€/Person) | Rating: 5,0 ⭐ | Luxusvilla mit Pool, traumhafte Lage
2. Villa Sant Josep – 6.459€ gesamt (~646€/Person) | Rating: 5,0 ⭐ | Stilvolle Villa nahe Strände  
3. Villa Santa Eulària – 7.805€ gesamt (~780€/Person) | Rating: 5,0 ⭐ | Moderne Villa mit Meerblick
4. Villa Sant Antoni – 2.953€ gesamt (~295€/Person) | Rating: 4,80 ⭐ | Günstige Option nahe Partyviertel
5. Privatunterkunft Santa Eulària – 2.784€ gesamt (~278€/Person) | Rating: 5,0 ⭐ | Beste Preis-Leistung
6. Privatunterkunft Sant Josep – 3.750€ gesamt (~375€/Person) | Rating: 4,91 ⭐ | Ruhige Lage im Süden
7. Finca Ibiza Stadt – 5.200€ gesamt (~520€/Person) | Rating: 4,75 ⭐ | Stadtnähe, rustikaler Charme
8. Villa Cala Tarida – 8.100€ gesamt (~810€/Person) | Rating: 5,0 ⭐ | Direkt am Strand, spektakuläre Aussicht

Reisedaten: 02.-08. Mai 2026 | 6 Nächte | 10 Personen
Alle Preise sind Gesamtpreise für die gesamte Gruppe für 6 Nächte.
`;

// ─── System Prompt (strictly sandboxed) ──────────────────────────────────────
const SYSTEM_PROMPT = `Du bist ein Reiseassistent NUR für Ibiza Trip Planung für eine Gruppe von 10 Personen (02.-08. Mai 2026).

WICHTIG - Deine Grenzen:
- Du hast keinen Zugriff auf persönliche Daten, Emails, Kalender, Finanzdaten oder andere private Informationen.
- Du antwortest AUSSCHLIESSLICH zu Ibiza-Reisethemen: Unterkünfte, Flüge, Aktivitäten, Tipps.
- Bei Fragen außerhalb des Reisethemas: "Ich bin nur für die Ibiza-Reiseplanung zuständig."
- Kein Zugriff auf externe Systeme außer den bereitgestellten Reisedaten.

Deine Fähigkeiten:
1. Airbnb Listings durchsuchen, filtern und empfehlen (basierend auf Budget, Lage, Rating)
2. Flugpreise erklären und Empfehlungen geben
3. Favoritenlisten im Chat erstellen (z.B. "Meine Top 3: ...")  
4. Meinungen zu Unterkünften geben basierend auf Rating und Preis-Leistung
5. Ibiza Reisetipps: beste Strände, Restaurants, Aktivitäten, Clubs

Verfügbare Unterkünfte:
${IBIZA_LISTINGS}

Kommunikationsstil: Freundlich, konkret, hilfsbereit. Antworte auf Deutsch.
Du bist für eine Freundesgruppe – sei locker und enthusiastisch über die Reise!`;

// ─── Amadeus Token Cache ──────────────────────────────────────────────────────
let amadeusToken: string | null = null;
let amadeusTokenExpiry = 0;

async function getAmadeusToken(): Promise<string | null> {
  if (amadeusToken && Date.now() < amadeusTokenExpiry) return amadeusToken;
  
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;
  if (!key || !secret) return null;

  try {
    const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${key}&client_secret=${secret}`,
    });
    const data = await res.json();
    amadeusToken = data.access_token;
    amadeusTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return amadeusToken;
  } catch {
    return null;
  }
}

async function searchFlights(origin: string): Promise<string> {
  const token = await getAmadeusToken();
  if (!token) return "Flugsuche nicht verfügbar (API nicht konfiguriert).";

  try {
    const url = new URL("https://test.api.amadeus.com/v2/shopping/flight-offers");
    url.searchParams.set("originLocationCode", origin.toUpperCase());
    url.searchParams.set("destinationLocationCode", "IBZ");
    url.searchParams.set("departureDate", "2026-05-02");
    url.searchParams.set("returnDate", "2026-05-08");
    url.searchParams.set("adults", "1");
    url.searchParams.set("max", "5");
    url.searchParams.set("currencyCode", "EUR");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return `Flugsuche fehlgeschlagen (${res.status}).`;

    const data = await res.json();
    const offers = data.data?.slice(0, 3) || [];
    if (!offers.length) return "Keine Flüge für diese Strecke gefunden.";

    const lines = offers.map((o: { price: { total: string }; itineraries: { segments: { departure: { iataCode: string; at: string }; arrival: { iataCode: string; at: string }; carrierCode: string }[] }[] }, i: number) => {
      const seg = o.itineraries[0]?.segments[0];
      const price = parseFloat(o.price.total);
      return `${i + 1}. ${seg?.carrierCode} | ${seg?.departure.iataCode} → ${seg?.arrival.iataCode} | ab ${price.toFixed(0)}€/Person | Abflug: ${seg?.departure.at?.slice(11, 16)}`;
    });

    return `Flüge von ${origin.toUpperCase()} nach Ibiza (02. Mai 2026):\n${lines.join("\n")}\n\nFür 10 Personen × Preis = Gesamtkosten Flüge.`;
  } catch {
    return "Fehler bei der Flugsuche. Bitte später versuchen.";
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte eine Minute." },
      { status: 429 }
    );
  }

  let messages: { role: string; content: string }[];
  try {
    const body = await request.json();
    messages = body.messages || [];
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  // Validate messages (no system messages from client)
  const cleanMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-10) // max 10 messages context
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })); // max 2000 chars per message

  if (!cleanMessages.length) {
    return NextResponse.json({ reply: "Hallo! Ich bin dein Ibiza Reiseassistent 🌴 Wie kann ich helfen?" });
  }

  // Check if flight search is needed
  const lastMsg = cleanMessages[cleanMessages.length - 1]?.content?.toLowerCase() || "";
  const flightOrigins: Record<string, string> = {
    "frankfurt": "FRA", "fra": "FRA",
    "münchen": "MUC", "munich": "MUC", "muc": "MUC",
    "berlin": "BER", "ber": "BER",
    "düsseldorf": "DUS", "dusseldorf": "DUS", "dus": "DUS",
    "hamburg": "HAM", "ham": "HAM",
    "köln": "CGN", "cologne": "CGN", "cgn": "CGN",
    "stuttgart": "STR", "str": "STR",
    "wien": "VIE", "vienna": "VIE", "vie": "VIE",
    "zürich": "ZRH", "zurich": "ZRH", "zrh": "ZRH",
  };

  let flightContext = "";
  if (lastMsg.includes("flug") || lastMsg.includes("flight") || lastMsg.includes("fliegen")) {
    for (const [city, code] of Object.entries(flightOrigins)) {
      if (lastMsg.includes(city)) {
        flightContext = "\n\nAktuelle Flugdaten:\n" + await searchFlights(code);
        break;
      }
    }
    if (!flightContext) {
      flightContext = "\n\nFlugdaten: Bitte nenne den Abflugort (z.B. Frankfurt, München, Berlin, Düsseldorf, Hamburg).";
    }
  }

  // Call LLM
  const apiKey = process.env.GITHUB_TOKEN;
  const baseUrl = "https://models.inference.ai.azure.com";
  const model = "gpt-4o-mini";

  if (!apiKey) {
    // Graceful fallback without LLM
    return NextResponse.json({ 
      reply: "Hi! Ich bin dein Ibiza Reiseassistent 🌴\n\n" + IBIZA_LISTINGS + (flightContext || "")
    });
  }

  try {
    const systemWithContext = SYSTEM_PROMPT + (flightContext ? `\n\nAktuelle Flugdaten für diese Anfrage:${flightContext}` : "");
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemWithContext },
          ...cleanMessages,
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Keine Antwort erhalten.";

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[public-agent] LLM error:", e instanceof Error ? e.message : e);
    return NextResponse.json({
      reply: "Entschuldigung, kurzer technischer Fehler. Bitte nochmal versuchen! 🙏",
    });
  }
}
