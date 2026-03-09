import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = "all", checkin, checkout, guests } = body;

    const results: { flights?: string; airbnb?: string; errors?: string[] } = {};
    const errors: string[] = [];

    // Flights: trigger Amadeus PowerShell script
    if (type === "all" || type === "flights") {
      try {
        const psScript = "C:\\Users\\Nikra\\.openclaw\\scripts\\amadeus-search.ps1";
        if (fs.existsSync(psScript)) {
          const params = [
            checkin ? `-CheckIn "${checkin}"` : "",
            checkout ? `-CheckOut "${checkout}"` : "",
            guests ? `-Guests ${guests}` : "",
          ].filter(Boolean).join(" ");
          const { stdout } = await execAsync(
            `powershell -ExecutionPolicy Bypass -File "${psScript}" ${params}`,
            { timeout: 30000 }
          );
          results.flights = stdout;
        } else {
          errors.push("amadeus-search.ps1 not found — flights skipped");
        }
      } catch (e: unknown) {
        errors.push(`Flights error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Airbnb: reload file (placeholder — in future trigger scraper)
    if (type === "all" || type === "airbnb") {
      try {
        const mdPath = "C:\\Users\\Nikra\\.openclaw\\workspace\\notes\\ibiza-airbnb-alle.md";
        if (fs.existsSync(mdPath)) {
          const content = fs.readFileSync(mdPath, "utf-8");
          const lines = content.split("\n").length;
          results.airbnb = `Loaded ${lines} lines from ibiza-airbnb-alle.md`;
        } else {
          errors.push("ibiza-airbnb-alle.md not found");
        }
      } catch (e: unknown) {
        errors.push(`Airbnb error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Data reload triggered",
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
