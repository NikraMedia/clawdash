import { NextResponse } from "next/server";
import * as fs from "fs";

const IBIZA_LISTINGS_PATH =
  "C:\\Users\\Nikra\\.openclaw\\workspace\\notes\\ibiza-airbnb-alle.md";

// Parse the markdown table into structured data
function parseAirbnbMarkdown(content: string) {
  const lines = content.split("\n");
  const listings: Array<{
    id: string;
    title: string;
    type: string;
    location: string;
    price: number | null;
    rating: number | null;
    link: string;
  }> = [];

  let currentRating: number | null = null;

  for (const line of lines) {
    // Detect rating section headers
    if (line.includes("Rating 5,0")) {
      currentRating = 5.0;
    } else if (line.match(/Rating (\d+[,.]?\d*)/)) {
      const m = line.match(/Rating (\d+[,.]?\d*)/);
      if (m) currentRating = parseFloat(m[1].replace(",", "."));
    } else if (line.includes("Ohne Rating")) {
      currentRating = null;
    }

    // Parse table rows
    if (!line.startsWith("|") || line.includes("---") || line.includes("Titel")) continue;

    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cols.length < 3) continue;

    // Try to detect if this is a row with index
    const firstCol = cols[0];
    if (!/^\d+$/.test(firstCol)) continue;

    const titleCol = cols[1] || "";
    const priceCol = cols[2] || "";
    const ratingCol = cols.length >= 5 ? cols[3] : null;
    const linkCol = cols[cols.length - 1] || "";

    // Extract type from title
    let type = "Privatunterkunft";
    if (titleCol.startsWith("Villa")) type = "Villa";
    else if (titleCol.startsWith("Cottage")) type = "Cottage";
    else if (titleCol.startsWith("Privatunterkunft")) type = "Privatunterkunft";
    else if (titleCol.startsWith("Eigentumswohnung")) type = "Wohnung";
    else if (titleCol.startsWith("Bauernhof")) type = "Bauernhof";
    else if (titleCol.startsWith("Casa")) type = "Casa Particular";

    // Extract location from title (after "in ")
    const locationMatch = titleCol.match(/in (.+)$/);
    const location = locationMatch ? locationMatch[1] : "Ibiza";

    // Parse price
    const priceMatch = priceCol.match(/([\d.]+)\s*EUR/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(".", ""), 10) : null;

    // Determine rating
    let rating = currentRating;
    if (ratingCol && /\d/.test(ratingCol)) {
      const r = parseFloat(ratingCol.replace(",", "."));
      if (!isNaN(r)) rating = r;
    }

    // Extract link
    const linkMatch = linkCol.match(/https?:\/\/[^\s)]+/);
    const link = linkMatch ? linkMatch[0] : "";

    // Extract room ID from link
    const idMatch = link.match(/\/rooms\/(\d+)/);
    const id = idMatch ? idMatch[1] : `row-${firstCol}`;

    listings.push({ id, title: titleCol, type, location, price, rating, link });
  }

  return listings;
}

export async function GET() {
  try {
    if (!fs.existsSync(IBIZA_LISTINGS_PATH)) {
      return NextResponse.json({ success: false, error: "Data file not found", listings: [] });
    }

    const content = fs.readFileSync(IBIZA_LISTINGS_PATH, "utf-8");
    const listings = parseAirbnbMarkdown(content);

    return NextResponse.json({
      success: true,
      listings,
      total: listings.length,
      lastUpdated: fs.statSync(IBIZA_LISTINGS_PATH).mtime.toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e), listings: [] },
      { status: 500 }
    );
  }
}
