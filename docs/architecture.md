# Architecture

Claw Dash is a Next.js application that connects to an [OpenClaw](https://github.com/openclaw) gateway over WebSocket and renders a real-time operator dashboard. This document describes how the pieces fit together.

## Data Flow

```
OpenClaw Gateway (ws://127.0.0.1:18789)
        │
        ▼
  GatewayClient                    ← WebSocket client, singleton via globalThis
        │
        ├──▶ EventCollector        ← in-memory ring buffer (1,000 events max)
        │
        ├──▶ ChatStreamBroker      ← pub/sub for live chat via SSE
        │
        ▼
  tRPC Routers                     ← thin RPC wrappers with Zod validation
        │
        ▼
  /api/trpc HTTP route             ← Next.js fetch adapter
        │
        ▼
  TRPCReactProvider                ← httpBatchLink, TanStack React Query
        │
        ▼
  React Components                 ← App Router pages + shadcn/ui
```

Every gateway interaction follows this path: the server-side `GatewayClient` holds a persistent WebSocket connection to the gateway. tRPC routers call methods on the client. The React frontend queries tRPC over HTTP, and TanStack React Query handles caching and refetching.

## Custom Server

Claw Dash does **not** use the default `next dev` server. Instead, `server.ts` boots a custom HTTP server that:

1. **Initializes the gateway connection** before accepting any HTTP requests
2. **Creates the EventCollector** — a ring buffer that stores the last 1,000 gateway events for the activity stream
3. **Creates the ChatStreamBroker** — a pub/sub system that routes live chat events to SSE subscribers
4. **Wires up event forwarding** — all gateway events are pushed into the collector, and `chat` events are additionally routed through the broker
5. **Starts the HTTP server** on `127.0.0.1:${CLAW_DASH_PORT}` (default 3939)
6. **Handles graceful shutdown** — on SIGTERM/SIGINT, disconnects the gateway client, closes the HTTP server, and force-exits after a 10-second timeout if shutdown hangs

This architecture ensures the gateway connection is established and ready before the first page load.

## Gateway Client

`src/lib/gateway/client.ts` implements a WebSocket client for OpenClaw Protocol v3.

### Connection Lifecycle

1. Opens a WebSocket to the gateway URL with an `Origin: http://localhost:3939` header (required for auth bypass on loopback)
2. Sends a `connect` RequestFrame with client identity, auth token, and requested scopes (`operator.read`, `operator.write`, `operator.admin`)
3. Receives a `hello-ok` response containing the server version, available methods/events, and an initial state snapshot
4. Begins processing RPC responses and real-time events

### Reconnection

If the connection drops unexpectedly, the client automatically reconnects with exponential backoff:

- Starts at 1 second, doubles each attempt, caps at 30 seconds
- Adds 10–20% random jitter to prevent thundering herd
- Resets backoff on successful reconnection

### RPC Pattern

All gateway calls go through `request<T>(method, params, timeout)`:

1. Generates a UUID request ID
2. Sends a JSON `RequestFrame` over WebSocket
3. Waits for a matching `ResponseFrame` (by ID)
4. Resolves or rejects a Promise based on `res.ok`
5. Times out after 30 seconds (configurable)

Convenience methods like `agentsList()`, `sessionsList()`, `cronList()`, and `chatSend()` wrap the generic `request()` with typed return values.

### Singleton

The client is attached to `globalThis` to survive Next.js Fast Refresh during development. The `getGateway()` function in `src/lib/gateway/index.ts` returns the singleton, creating it on first call.

### Token Resolution

The auth token is resolved in order:

1. `OPENCLAW_GATEWAY_TOKEN` environment variable
2. `GATEWAY_AUTH_TOKEN` in `~/.openclaw/.env`
3. Empty string (connection will likely fail)

## Event System

Two server-side systems handle real-time data:

### EventCollector

`src/lib/collector/index.ts` — An in-memory ring buffer that stores gateway events for the activity stream.

- **Capacity:** 1,000 events (oldest are evicted when full)
- **Severity classification:** Each event is classified as `info`, `warning`, or `error` based on the event name and payload
- **Agent extraction:** Agent IDs are extracted from payloads when present
- **Default filtering:** Noise events (`tick`, `presence`) are hidden by default. Chat events only show `final`, `error`, and `aborted` states. Health events only show when they carry warnings or errors.
- **Query API:** Supports filtering by agent, event type, severity, and a `showAll` flag to bypass default filtering

### ChatStreamBroker

`src/lib/chat-stream-broker.ts` — A pub/sub broker for live chat streaming.

- **Keyed by session:** Each subscription is tied to a specific session key
- **SSE delivery:** The `/api/stream/[sessionKey]` route subscribes to the broker and streams events to the browser via Server-Sent Events
- **Automatic cleanup:** Unsubscribe functions remove listeners and clean up empty session entries

Both are singletons on `globalThis` for the same Fast Refresh reason as the gateway client.

## tRPC Layer

### Context

`src/server/trpc.ts` creates a context object containing the gateway singleton. Every tRPC procedure has access to `ctx.gateway`.

### Routers

`src/server/routers/_app.ts` merges four sub-routers:

| Router | Purpose |
|--------|---------|
| `system` | Gateway health, config, models, channels, logs, exec approvals, skills |
| `agents` | Agent listing and agent file inspection |
| `sessions` | Session listing, preview, patching, chat send/abort/history, usage computation |
| `cron` | Cron job listing, running, updating, run history |

Routers are intentionally thin — they validate inputs with Zod and delegate to `GatewayClient` methods. There is minimal business logic in the tRPC layer.

### Client-Side Usage

Components use the `useTRPC()` hook from `src/lib/trpc/react.tsx` to get a typed tRPC client:

```tsx
const trpc = useTRPC();

// Query
const { data } = useQuery(trpc.sessions.list.queryOptions({ limit: 50 }));

// Mutation
const mutation = useMutation(trpc.cron.run.mutationOptions());
```

The tRPC client uses `httpBatchLink` to batch multiple queries into a single HTTP request. Most queries refetch on a 5-second interval via TanStack React Query's `refetchInterval`.

## UI Architecture

### App Router Pages

| Route | Page |
|-------|------|
| `/` | Dashboard home — health cards, topology graph, active sessions, recent alerts |
| `/sessions` | Session list with search and filters |
| `/sessions/[key]` | Session workspace — chat transcript, composer, config, insights, orchestration |
| `/activity` | Event feed with severity/type/agent filters and freshness tracking |
| `/cron` | Cron job management — status grid, timeline, run history |
| `/system` | System console — tabbed config editor, model browser, channel inspector, skills, exec approvals, diagnostics |

### Component Organization

Components are grouped by domain under `src/components/`:

- `ui/` — Shared primitives built with shadcn/ui (Button, Switch, Badge, etc.)
- `sessions/` — Session workspace: transcript, composer, sidebar tabs
- `topology/` — React Flow graph for system visualization
- `home/` — Dashboard home widgets
- `cron/` — Cron management: status grid, timeline, run history
- `activity/` — Activity stream with filters
- `system/` — System page: config editor, model list, channel status
- `layout/` — Sidebar navigation, topbar, offline banner

### Styling

- **Dark theme only** — `html.dark` class, zinc-950 background
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** components installed via the `shadcn` CLI
- **No raw `style` attributes** — all styling through Tailwind utilities

### Key Libraries

| Library | Usage |
|---------|-------|
| `@xyflow/react` | Topology graph with minimap and controls |
| `cmdk` | Command palette (`Cmd+K`) for quick actions |
| `react-markdown` + `remark-gfm` | Markdown rendering in chat transcripts |
| `react-syntax-highlighter` | Code block highlighting |
| `lucide-react` | Icons throughout the UI |
