import { NextResponse } from "next/server";
import FirecrawlApp from "@mendable/firecrawl-js";

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

// ─── Amadeus Token ────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAmadeusToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
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
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

// ─── IATA Code Lookup (common cities) ─────────────────────────────────────────
const CITY_TO_IATA: Record<string, string> = {
  "frankfurt": "FRA", "münchen": "MUC", "munich": "MUC", "berlin": "BER",
  "düsseldorf": "DUS", "hamburg": "HAM", "köln": "CGN", "cologne": "CGN",
  "stuttgart": "STR", "nürnberg": "NUE", "hannover": "HAJ", "bremen": "BRE",
  "wien": "VIE", "vienna": "VIE", "zürich": "ZRH", "zurich": "ZRH",
  "london": "LHR", "paris": "CDG", "amsterdam": "AMS", "barcelona": "BCN",
  "madrid": "MAD", "rome": "FCO", "rom": "FCO", "milan": "MXP", "mailand": "MXP",
  "lisbon": "LIS", "lissabon": "LIS", "athens": "ATH", "athen": "ATH",
  "istanbul": "IST", "dubai": "DXB", "new york": "JFK", "newyork": "JFK",
  "los angeles": "LAX", "tokyo": "NRT", "tokio": "NRT", "singapore": "SIN",
  "singapur": "SIN", "bangkok": "BKK", "bali": "DPS", "ibiza": "IBZ",
  "mallorca": "PMI", "teneriffa": "TFN", "lanzarote": "ACE", "fuerteventura": "FUE",
  "gran canaria": "LPA", "kreta": "HER", "crete": "HER", "mykonos": "JMK",
  "santorini": "JTR", "rhodos": "RHO", "corfu": "CFU", "korfu": "CFU",
  "palma": "PMI", "nice": "NCE", "nizza": "NCE", "dubrovnik": "DBV",
  "split": "SPU", "pula": "PUY", "zadar": "ZAD", "zagreb": "ZAG",
  "budapest": "BUD", "prag": "PRG", "prague": "PRG", "warschau": "WAW", "warsaw": "WAW",
  "kopenhagen": "CPH", "copenhagen": "CPH", "stockholm": "ARN", "oslo": "OSL",
  "helsinki": "HEL", "dublin": "DUB", "edinburgh": "EDI", "brussels": "BRU",
  "brüssel": "BRU",
};

function cityToIata(city: string): string | null {
  const lower = city.toLowerCase().trim();
  // Direct match
  if (CITY_TO_IATA[lower]) return CITY_TO_IATA[lower];
  // Partial match
  for (const [key, code] of Object.entries(CITY_TO_IATA)) {
    if (lower.includes(key) || key.includes(lower)) return code;
  }
  // If 3 uppercase letters, assume it's already IATA
  if (/^[A-Z]{3}$/.test(city.toUpperCase())) return city.toUpperCase();
  return null;
}

// ─── Amadeus Flight Search ────────────────────────────────────────────────────
async function searchFlights(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  maxResults?: number;
}) {
  const token = await getAmadeusToken();
  if (!token) return { error: "Amadeus API nicht konfiguriert" };

  const originCode = cityToIata(params.origin);
  const destCode = cityToIata(params.destination);

  if (!originCode) return { error: `Flughafen für "${params.origin}" nicht gefunden. Bitte IATA-Code verwenden (z.B. FRA, MUC, BER).` };
  if (!destCode) return { error: `Flughafen für "${params.destination}" nicht gefunden.` };

  try {
    const url = new URL("https://test.api.amadeus.com/v2/shopping/flight-offers");
    url.searchParams.set("originLocationCode", originCode);
    url.searchParams.set("destinationLocationCode", destCode);
    url.searchParams.set("departureDate", params.departureDate);
    if (params.returnDate) url.searchParams.set("returnDate", params.returnDate);
    url.searchParams.set("adults", String(Math.min(params.adults, 9)));
    url.searchParams.set("max", String(params.maxResults ?? 5));
    url.searchParams.set("currencyCode", "EUR");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: `Amadeus Fehler ${res.status}: ${JSON.stringify(err)}` };
    }

    const data = await res.json();
    const offers = data.data ?? [];

    if (!offers.length) return { flights: [], message: "Keine Flüge gefunden für diese Strecke/Datum." };

    const flights = offers.slice(0, params.maxResults ?? 5).map((o: {
      price: { total: string; currency: string };
      itineraries: { duration: string; segments: { departure: { iataCode: string; at: string }; arrival: { iataCode: string; at: string }; carrierCode: string; numberOfStops?: number }[] }[];
    }) => {
      const outbound = o.itineraries[0];
      const inbound = o.itineraries[1];
      const firstSeg = outbound?.segments[0];
      const lastSeg = outbound?.segments[outbound.segments.length - 1];
      return {
        price: parseFloat(o.price.total),
        currency: o.price.currency,
        carrier: firstSeg?.carrierCode,
        departure: firstSeg?.departure?.at,
        arrival: lastSeg?.arrival?.at,
        origin: originCode,
        destination: destCode,
        duration: outbound?.duration,
        stops: outbound?.segments.length - 1,
        returnDeparture: inbound?.segments[0]?.departure?.at,
        returnArrival: inbound?.segments[inbound.segments.length - 1]?.arrival?.at,
      };
    });

    return { flights, originCode, destCode };
  } catch (e) {
    return { error: `Fehler: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── Airbnb URL Builder ───────────────────────────────────────────────────────
function buildAirbnbUrl(destination: string, checkin: string, checkout: string, guests: number): string {
  const params = new URLSearchParams({
    query: destination,
    checkin,
    checkout,
    adults: String(guests),
    tab_id: "home_tab",
    refinement_paths: "/homes",
    source: "structured_search_input_header",
    search_type: "filter_change",
  });
  return `https://www.airbnb.com/s/${encodeURIComponent(destination)}/homes?${params.toString()}`;
}

// ─── Scrape Airbnb via Firecrawl ─────────────────────────────────────────────
async function fetchAirbnbListings(destination: string, checkin: string, checkout: string, guests: number) {
  const searchUrl = buildAirbnbUrl(destination, checkin, checkout, guests);
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    return {
      searchUrl,
      message: `Airbnb-Direktsuche für ${destination}: ${searchUrl}`,
      note: "Firecrawl API Key nicht konfiguriert.",
    };
  }

  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    const result = await firecrawl.scrape(searchUrl, {
      formats: ["markdown"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markdown = (result as any)?.markdown as string | undefined;
    if (markdown && markdown.length > 100) {
      // Parse listings from markdown — basic extraction
      const lines = markdown.split("\n");
      const listings: { title: string; price: string; rating: string; link: string }[] = [];
      for (let i = 0; i < lines.length && listings.length < 10; i++) {
        const line = lines[i].trim();
        // Look for listing patterns (price + title nearby)
        const priceMatch = line.match(/(\d+[\.,]\d*)\s*€|€\s*(\d+[\.,]\d*)/);
        if (priceMatch) {
          const price = priceMatch[0];
          const title = lines[i - 1]?.trim() || lines[i + 1]?.trim() || "Unterkunft";
          const ratingLine = lines.slice(Math.max(0, i - 3), i + 3).find((l) => l.match(/[4-5][.,]\d/));
          const rating = ratingLine?.match(/[4-5][.,]\d/)?.[0] || "";
          listings.push({ title, price, rating, link: searchUrl });
        }
      }
      if (listings.length > 0) {
        return { listings, searchUrl, source: "firecrawl" };
      }
    }
  } catch (e) {
    console.warn("Firecrawl scrape failed, falling back:", e instanceof Error ? e.message : String(e));
  }

  // Fallback: return search URL
  return {
    searchUrl,
    listings: [],
    source: "fallback",
    message: `Airbnb-Direktsuche für ${destination}`,
    note: "Live-Scraping nicht verfügbar. Bitte Airbnb-Link direkt öffnen.",
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded. Bitte warte eine Minute." }, { status: 429 });
  }

  let body: {
    action: string;
    origin?: string;
    destination?: string;
    checkin?: string;
    checkout?: string;
    guests?: number;
    returnDate?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  if (action === "search_flights") {
    if (!body.origin || !body.destination || !body.checkin) {
      return NextResponse.json({ error: "origin, destination und checkin sind erforderlich" }, { status: 400 });
    }
    const result = await searchFlights({
      origin: body.origin,
      destination: body.destination,
      departureDate: body.checkin,
      returnDate: body.returnDate,
      adults: body.guests ?? 1,
      maxResults: 5,
    });
    return NextResponse.json(result);
  }

  if (action === "search_airbnb") {
    if (!body.destination || !body.checkin || !body.checkout) {
      return NextResponse.json({ error: "destination, checkin, checkout sind erforderlich" }, { status: 400 });
    }
    const result = await fetchAirbnbListings(
      body.destination, body.checkin, body.checkout, body.guests ?? 2
    );
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
