"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plane,
  Home,
  Send,
  X,
  MapPin,
  Calendar,
  Users,
  Search,
  ExternalLink,
  Heart,
  Star,
  Euro,
  MessageCircle,
  Loader2,
  Globe,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlightOffer {
  price: number;
  currency: string;
  carrier: string;
  departure: string;
  arrival: string;
  origin: string;
  destination: string;
  duration: string;
  stops: number;
  returnDeparture?: string;
  returnArrival?: string;
}

interface SearchState {
  destination: string;
  checkin: string;
  checkout: string;
  guests: number;
  origin: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(iso: string): string {
  if (!iso) return "";
  const h = iso.match(/(\d+)H/)?.[1];
  const m = iso.match(/(\d+)M/)?.[1];
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(checkin);
  const b = new Date(checkout);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

// ─── Popular Destinations ─────────────────────────────────────────────────────

const POPULAR = [
  { label: "Ibiza", emoji: "🌴", country: "Spanien" },
  { label: "Barcelona", emoji: "🏖️", country: "Spanien" },
  { label: "Mallorca", emoji: "☀️", country: "Spanien" },
  { label: "Santorini", emoji: "🏛️", country: "Griechenland" },
  { label: "Bali", emoji: "🌺", country: "Indonesien" },
  { label: "Amsterdam", emoji: "🚲", country: "Niederlande" },
  { label: "Lissabon", emoji: "🎵", country: "Portugal" },
  { label: "Dubrovnik", emoji: "🏰", country: "Kroatien" },
];

// ─── Flight Card ──────────────────────────────────────────────────────────────

function FlightCard({ flight, guests }: { flight: FlightOffer; guests: number }) {
  const totalPrice = flight.price * guests;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Plane className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-zinc-100">{flight.carrier}</span>
          <span className="text-xs text-zinc-500">{flight.stops === 0 ? "Direktflug" : `${flight.stops} Stopp`}</span>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-emerald-400">{flight.price.toFixed(0)}€ <span className="text-xs font-normal text-zinc-500">/Person</span></div>
          <div className="text-xs text-zinc-500">= {totalPrice.toFixed(0)}€ gesamt</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">{flight.origin}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-zinc-300">{flight.destination}</span>
        <span className="text-zinc-600">·</span>
        <span>{formatDateTime(flight.departure)}</span>
        {flight.duration && (
          <>
            <span className="text-zinc-600">·</span>
            <span>{formatDuration(flight.duration)}</span>
          </>
        )}
      </div>
      {flight.returnDeparture && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 border-t border-zinc-800 pt-2">
          <span className="text-zinc-600">Rückflug:</span>
          <span>{formatDateTime(flight.returnDeparture)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  open,
  onClose,
  searchState,
  flights,
}: {
  open: boolean;
  onClose: () => void;
  searchState: SearchState;
  flights: FlightOffer[] | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey! 👋 Ich bin dein Travel Agent. Frag mich zu Unterkünften, Flügen, Budget oder Reisetipps für deine Destination!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Reset messages when destination changes
  useEffect(() => {
    if (searchState.destination) {
      setMessages([
        {
          role: "assistant",
          content: `Hey! 🌍 Du suchst für **${searchState.destination}** (${searchState.checkin} – ${searchState.checkout}, ${searchState.guests} ${searchState.guests === 1 ? "Person" : "Personen"}).\n\nWie kann ich helfen? Ich kann Unterkünfte empfehlen, Flüge erklären oder Tipps zur Destination geben!`,
        },
      ]);
    }
  }, [searchState.destination]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const airbnbUrl = searchState.destination
        ? `https://www.airbnb.com/s/${encodeURIComponent(searchState.destination)}/homes?checkin=${searchState.checkin}&checkout=${searchState.checkout}&adults=${searchState.guests}`
        : undefined;

      const res = await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            destination: searchState.destination,
            checkin: searchState.checkin,
            checkout: searchState.checkout,
            guests: searchState.guests,
            flights: flights ? { flights } : undefined,
            airbnbUrl,
          },
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || data.error || "Fehler" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Verbindungsfehler. Bitte nochmal!" }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none sm:items-end">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/60 flex flex-col overflow-hidden h-[520px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-100">Travel Agent AI</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                Online
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-3 py-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 border-t border-zinc-800 p-3 shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Frag mich was zur Reise..."
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 shrink-0 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TravelPage() {
  const [destination, setDestination] = useState("");
  const [checkin, setCheckin] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [checkout, setCheckout] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 37);
    return d.toISOString().slice(0, 10);
  });
  const [guests, setGuests] = useState(2);
  const [origin, setOrigin] = useState("Frankfurt");

  const [chatOpen, setChatOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  // Flight state
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [flights, setFlights] = useState<FlightOffer[] | null>(null);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [airbnbUrl, setAirbnbUrl] = useState<string | null>(null);

  const nights = nightsBetween(checkin, checkout);

  const handleSearch = useCallback(async () => {
    if (!destination.trim()) return;
    setSearched(true);
    setFlights(null);
    setFlightError(null);
    setChatOpen(true);

    // Build Airbnb URL
    const url = `https://www.airbnb.com/s/${encodeURIComponent(destination)}/homes?checkin=${checkin}&checkout=${checkout}&adults=${guests}&tab_id=home_tab`;
    setAirbnbUrl(url);

    // Search flights
    setLoadingFlights(true);
    try {
      const res = await fetch("/api/travel-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search_flights",
          origin,
          destination,
          checkin,
          returnDate: checkout,
          guests: Math.min(guests, 9),
        }),
      });
      const data = await res.json();
      if (data.error) setFlightError(data.error);
      else setFlights(data.flights ?? []);
    } catch (e) {
      setFlightError("Flugsuche fehlgeschlagen.");
    } finally {
      setLoadingFlights(false);
    }
  }, [destination, checkin, checkout, guests, origin]);

  const searchState: SearchState = { destination, checkin, checkout, guests, origin };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-950">
      {/* Hero */}
      <div className="shrink-0 border-b border-zinc-800/60 bg-gradient-to-br from-zinc-900 via-blue-950/20 to-zinc-900 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">AI Travel Planner</h1>
              <p className="text-xs text-zinc-500">Flüge, Unterkünfte & Tipps — alles an einem Ort</p>
            </div>
          </div>

          {/* Search Form */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Destination */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                <MapPin className="h-3.5 w-3.5 inline mr-1" />Wohin?
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="z.B. Ibiza, Barcelona, Bali, Santorini..."
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
            </div>

            {/* Origin */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                <Plane className="h-3.5 w-3.5 inline mr-1" />Abflugort
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="z.B. Frankfurt, München..."
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
            </div>

            {/* Guests */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                <Users className="h-3.5 w-3.5 inline mr-1" />Personen
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
            </div>

            {/* Check-in */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                <Calendar className="h-3.5 w-3.5 inline mr-1" />Check-in
              </label>
              <input
                type="date"
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-4 py-3 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
            </div>

            {/* Check-out */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                <Calendar className="h-3.5 w-3.5 inline mr-1" />Check-out
              </label>
              <input
                type="date"
                value={checkout}
                onChange={(e) => setCheckout(e.target.value)}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-4 py-3 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
            </div>

            {/* Search Button */}
            <div className="sm:col-span-2">
              <button
                onClick={handleSearch}
                disabled={!destination.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Search className="h-4 w-4" />
                Suchen & AI Agent starten
                <Sparkles className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>
          </div>

          {/* Popular Destinations */}
          <div className="mt-4">
            <p className="text-xs text-zinc-600 mb-2">Beliebt:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((d) => (
                <button
                  key={d.label}
                  onClick={() => {
                    setDestination(d.label);
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                    destination === d.label
                      ? "border-blue-500/60 bg-blue-500/10 text-blue-300"
                      : "border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  <span>{d.emoji}</span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {searched && (
        <div className="flex-1 px-6 py-6 max-w-2xl mx-auto w-full">
          {/* Flights Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <Plane className="h-4 w-4 text-blue-400" />
                Flüge: {origin} → {destination}
              </h2>
              <button
                onClick={handleSearch}
                disabled={loadingFlights}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${loadingFlights ? "animate-spin" : ""}`} />
                Aktualisieren
              </button>
            </div>

            {loadingFlights && (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                Suche Flüge via Amadeus...
              </div>
            )}

            {flightError && !loadingFlights && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
                {flightError}
              </div>
            )}

            {flights && flights.length === 0 && !loadingFlights && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
                Keine Flüge gefunden. Versuche einen anderen Abflugort oder Zeitraum.
              </div>
            )}

            {flights && flights.length > 0 && !loadingFlights && (
              <div className="flex flex-col gap-3">
                {flights.map((f, i) => (
                  <FlightCard key={i} flight={f} guests={guests} />
                ))}
                <p className="text-xs text-zinc-600 mt-1">
                  * Preise sind Richtwerte via Amadeus Test API. Finale Preise auf der Airline-Website.
                </p>
              </div>
            )}
          </div>

          {/* Airbnb Section */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
              <Home className="h-4 w-4 text-rose-400" />
              Unterkünfte in {destination}
            </h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Home className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Airbnb Direktsuche</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {guests} {guests === 1 ? "Person" : "Personen"} · {nights} {nights === 1 ? "Nacht" : "Nächte"} · {checkin} – {checkout}
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Airbnb-Listings werden direkt auf airbnb.com geladen (Server-seitige Anfragen werden geblockt). Klick unten um die gefilterte Suche zu öffnen — dann kannst du die Ergebnisse im AI Chat besprechen.
              </p>

              {airbnbUrl && (
                <a
                  href={airbnbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 py-3 text-sm font-semibold text-white hover:from-rose-500 hover:to-pink-500 transition-all shadow-lg shadow-rose-500/20"
                >
                  <ExternalLink className="h-4 w-4" />
                  Airbnb öffnen: {destination}
                </a>
              )}

              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2.5 text-xs text-blue-300 flex items-start gap-2">
                <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Finde interessante Listings auf Airbnb und teile die Links im Chat — ich analysiere und empfehle dir die besten!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searched && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20">
                <Globe className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">Wohin geht die Reise?</h2>
            <p className="text-sm text-zinc-500">
              Gib deine Destination ein und ich suche automatisch Flüge via Amadeus und helfe dir mit dem AI Chat beim Finden der besten Unterkunft.
            </p>
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setChatOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-full py-3 px-4 font-medium text-sm text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${
            chatOpen
              ? "bg-zinc-700 shadow-zinc-500/20"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30"
          }`}
        >
          {chatOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          {chatOpen ? "Schließen" : "AI Agent"}
        </button>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        searchState={searchState}
        flights={flights}
      />
    </div>
  );
}
