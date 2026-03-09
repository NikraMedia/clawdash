"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Heart,
  RefreshCw,
  Share2,
  Star,
  MapPin,
  Euro,
  ExternalLink,
  MessageCircle,
  X,
  Send,
  Plane,
  Home,
  Filter,
  SlidersHorizontal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sun,
  Users,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  title: string;
  type: string;
  location: string;
  price: number | null;
  rating: number | null;
  link: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHARE_TEXT =
  "Ibiza Trip Planner 🌴 02.–08. Mai 2026 für 10 Personen — check unsere Unterkünfte!";

const TYPE_OPTIONS = ["Alle", "Villa", "Privatunterkunft", "Cottage", "Wohnung", "Bauernhof"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price === null) return "–";
  return `${price.toLocaleString("de-DE")} €`;
}

function formatPricePerPerson(price: number | null): string {
  if (price === null) return "";
  const pp = Math.round(price / 10);
  return `~${pp.toLocaleString("de-DE")} €/P`;
}

function getRatingColor(rating: number | null): string {
  if (rating === null) return "text-zinc-500";
  if (rating >= 4.9) return "text-emerald-400";
  if (rating >= 4.7) return "text-yellow-400";
  return "text-orange-400";
}

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    Villa: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    Privatunterkunft: "bg-zinc-700/50 text-zinc-300 border-zinc-600/30",
    Cottage: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    Wohnung: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    Bauernhof: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    "Casa Particular": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  };
  return map[type] || "bg-zinc-700/50 text-zinc-300 border-zinc-600/30";
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  isFav,
  onToggleFav,
}: {
  listing: Listing;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) {
  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 transition-all hover:border-zinc-700/80 hover:bg-zinc-900/90 hover:shadow-lg hover:shadow-black/20">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getTypeColor(listing.type)}`}
          >
            {listing.type}
          </span>
          <h3 className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2">
            {listing.title}
          </h3>
        </div>
        <button
          onClick={() => onToggleFav(listing.id)}
          className={`shrink-0 rounded-full p-1.5 transition-all ${
            isFav
              ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
              : "text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10"
          }`}
        >
          <Heart className={`h-4 w-4 ${isFav ? "fill-rose-400" : ""}`} />
        </button>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{listing.location}</span>
      </div>

      {/* Price + Rating */}
      <div className="flex items-end justify-between gap-2 mt-auto pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-zinc-100">
            {formatPrice(listing.price)}
          </span>
          {listing.price && (
            <span className="text-[11px] text-zinc-500">
              {formatPricePerPerson(listing.price)} · 6 Nächte
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {listing.rating !== null ? (
            <div className={`flex items-center gap-1 text-sm font-semibold ${getRatingColor(listing.rating)}`}>
              <Star className="h-3.5 w-3.5 fill-current" />
              <span>{listing.rating.toFixed(2).replace(".", ",")}</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-600">Neu</span>
          )}
        </div>
      </div>

      {/* Link */}
      <a
        href={listing.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-700/80 hover:text-zinc-100 border border-zinc-700/40"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Auf Airbnb ansehen
      </a>
    </div>
  );
}

// ─── Chat Widget ──────────────────────────────────────────────────────────────

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey! 👋 Ich bin dein Ibiza-Reiseberater. Frag mich zu Unterkünften, Budget oder der Reiseplanung für euren Trip 02.–08. Mai 2026!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Verbindungsfehler. Bitte nochmal versuchen." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600">
                <Sun className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-100">Ibiza AI</p>
                <p className="text-[10px] text-zinc-500">Reiseberater</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3 overflow-y-auto p-4 h-72">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
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
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 border-t border-zinc-800 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Frag mich was..."
              className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition-all hover:bg-indigo-500 disabled:opacity-40 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IbizaPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  // Filters
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "price-asc" | "price-desc">("rating");
  const [filterType, setFilterType] = useState("Alle");
  const [priceMax, setPriceMax] = useState(90000);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Favorites
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  // Share
  const [copied, setCopied] = useState(false);

  // Dates
  const [checkin, setCheckin] = useState("2026-05-02");
  const [checkout, setCheckout] = useState("2026-05-08");
  const [guests, setGuests] = useState(10);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ibiza-favs");
      if (stored) setFavIds(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  function toggleFav(id: string) {
    setFavIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("ibiza-favs", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }

  // Load listings
  async function loadListings() {
    setLoadingListings(true);
    setLoadingError(null);
    try {
      const res = await fetch("/api/ibiza-listings");
      const data = await res.json();
      if (data.success) {
        setListings(data.listings);
      } else {
        setLoadingError(data.error || "Unbekannter Fehler");
      }
    } catch (e) {
      setLoadingError("Verbindungsfehler beim Laden der Listings");
    } finally {
      setLoadingListings(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  // Scrape
  async function triggerScrape() {
    setScraping(true);
    setScrapeMsg(null);
    try {
      const res = await fetch("/api/scrape-ibiza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin, checkout, guests }),
      });
      const data = await res.json();
      setScrapeMsg(data.message || "Erledigt!");
      await loadListings();
    } catch {
      setScrapeMsg("Fehler beim Ausführen des Scrapers.");
    } finally {
      setScraping(false);
      setTimeout(() => setScrapeMsg(null), 5000);
    }
  }

  // Share
  function handleShare() {
    const url = window.location.href;
    const text = `${SHARE_TEXT}\n${url}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // Filtered + sorted listings
  const displayListings = useMemo(() => {
    let list = listings;

    if (showFavsOnly) list = list.filter((l) => favIds.has(l.id));
    if (filterType !== "Alle") list = list.filter((l) => l.type === filterType);
    list = list.filter((l) => l.price === null || l.price <= priceMax);
    if (minRating > 0) list = list.filter((l) => l.rating !== null && l.rating >= minRating);

    list = [...list].sort((a, b) => {
      if (sortBy === "rating") {
        const ra = a.rating ?? 0;
        const rb = b.rating ?? 0;
        return rb - ra;
      }
      if (sortBy === "price-asc") {
        const pa = a.price ?? Infinity;
        const pb = b.price ?? Infinity;
        return pa - pb;
      }
      if (sortBy === "price-desc") {
        const pa = a.price ?? 0;
        const pb = b.price ?? 0;
        return pb - pa;
      }
      return 0;
    });

    return list;
  }, [listings, showFavsOnly, favIds, filterType, priceMax, minRating, sortBy]);

  const priceAbsMax = useMemo(() => {
    const prices = listings.map((l) => l.price ?? 0);
    return Math.max(...prices, 90000);
  }, [listings]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero Header */}
      <div className="shrink-0 border-b border-zinc-800/60 bg-gradient-to-r from-zinc-900 via-indigo-950/30 to-zinc-900 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌴</span>
              <h1 className="text-xl font-bold text-zinc-100">Ibiza Trip Planner</h1>
            </div>
            <p className="text-sm text-zinc-400 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                02.–08. Mai 2026
              </span>
              <span className="text-zinc-600">·</span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-indigo-400" />
                10 Personen
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">6 Nächte</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-700/80 hover:text-zinc-100"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? "Kopiert!" : "Teilen"}
            </button>
            <button
              onClick={triggerScrape}
              disabled={scraping}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scraping ? "animate-spin" : ""}`} />
              {scraping ? "Lädt..." : "Neue Daten laden"}
            </button>
          </div>
        </div>
        {scrapeMsg && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
            ✓ {scrapeMsg}
          </div>
        )}
      </div>

      {/* Date/Guest Picker */}
      <div className="shrink-0 border-b border-zinc-800/40 bg-zinc-900/40 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Check-in</span>
            <input
              type="date"
              value={checkin}
              onChange={(e) => setCheckin(e.target.value)}
              className="rounded-md bg-zinc-800/60 border border-zinc-700/40 px-2 py-1 text-zinc-200 text-xs outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Check-out</span>
            <input
              type="date"
              value={checkout}
              onChange={(e) => setCheckout(e.target.value)}
              className="rounded-md bg-zinc-800/60 border border-zinc-700/40 px-2 py-1 text-zinc-200 text-xs outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="number"
              value={guests}
              min={1}
              max={20}
              onChange={(e) => setGuests(parseInt(e.target.value) || 10)}
              className="w-16 rounded-md bg-zinc-800/60 border border-zinc-700/40 px-2 py-1 text-zinc-200 text-xs outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
            <span className="text-zinc-500">Gäste</span>
          </div>
        </div>
      </div>

      {/* Flights placeholder */}
      <div className="shrink-0 border-b border-zinc-800/40 mx-6 my-4 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 text-indigo-400 rotate-45" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Flüge</p>
              <p className="text-xs text-zinc-500">Noch keine Flugdaten geladen. Klick auf "Neue Daten laden" um Amadeus zu starten.</p>
            </div>
          </div>
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${scraping ? "animate-spin" : ""}`} />
            Flüge laden
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="shrink-0 px-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Favs toggle */}
            <button
              onClick={() => setShowFavsOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                showFavsOnly
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${showFavsOnly ? "fill-rose-400 text-rose-400" : ""}`} />
              Favoriten {favIds.size > 0 && `(${favIds.size})`}
            </button>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500/40"
            >
              <option value="rating">⭐ Rating</option>
              <option value="price-asc">€ Preis aufsteigend</option>
              <option value="price-desc">€ Preis absteigend</option>
            </select>

            {/* Type filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500/40"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          <div className="text-xs text-zinc-500">
            {displayListings.length} von {listings.length} Unterkünfte
          </div>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-6 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <div className="flex flex-col gap-2 min-w-48">
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Max. Preis: {formatPrice(priceMax)}
              </label>
              <input
                type="range"
                min={1000}
                max={priceAbsMax}
                step={500}
                value={priceMax}
                onChange={(e) => setPriceMax(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>1.000 €</span>
                <span>{formatPrice(priceAbsMax)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-48">
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Min. Rating: {minRating > 0 ? minRating.toFixed(1).replace(".", ",") : "Alle"}
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Alle</span>
                <span>5,0</span>
              </div>
            </div>

            <button
              onClick={() => {
                setPriceMax(priceAbsMax);
                setMinRating(0);
                setFilterType("Alle");
                setSortBy("rating");
                setShowFavsOnly(false);
              }}
              className="self-end rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
            >
              Zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Listings Grid */}
      <div className="flex-1 px-6 pb-24">
        {loadingListings ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          </div>
        ) : loadingError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-red-400">Fehler: {loadingError}</p>
            <button
              onClick={loadListings}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500 transition-all"
            >
              Nochmal versuchen
            </button>
          </div>
        ) : displayListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-zinc-600">
            <Home className="h-10 w-10 opacity-20" />
            <p className="text-sm">Keine Unterkünfte mit diesen Filtern gefunden.</p>
            <button
              onClick={() => {
                setPriceMax(priceAbsMax);
                setMinRating(0);
                setFilterType("Alle");
                setShowFavsOnly(false);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFav={favIds.has(listing.id)}
                onToggleFav={toggleFav}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
