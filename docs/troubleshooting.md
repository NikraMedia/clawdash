# Troubleshooting

Common issues and solutions when running Claw Dash.

## Gateway Connection

### "Not connected to gateway" errors

The most common issue. Claw Dash cannot reach the OpenClaw gateway.

**Check the gateway is running:**

```bash
# Verify the gateway process is active
ps aux | grep openclaw

# Or check the default port is listening
lsof -i :18789
```

**Check your gateway URL:**

The default is `ws://127.0.0.1:18789`. If your gateway runs on a different address or port, update `.env.local`:

```
OPENCLAW_GATEWAY_URL=ws://your-host:your-port
```

**Run the probe:**

```bash
npm run probe
```

This performs a standalone WebSocket handshake and RPC test. It will report exactly where the connection fails (DNS, TCP, WebSocket upgrade, auth, or RPC).

### "Gateway handshake failed"

The WebSocket connection opened, but the protocol handshake was rejected.

- **Auth token mismatch:** Verify your token matches the gateway's expected token. Check `OPENCLAW_GATEWAY_TOKEN` in `.env.local` or `GATEWAY_AUTH_TOKEN` in `~/.openclaw/.env`.
- **Protocol version:** Claw Dash requires OpenClaw Protocol v3. Older gateway versions may not support it.
- **Origin header rejected:** The gateway expects `Origin: http://localhost:3939` for loopback auth bypass. If you changed `CLAW_DASH_PORT`, also set `CLAW_DASH_ORIGIN` to match.

### Gateway disconnects and reconnects

This is normal behavior. Claw Dash automatically reconnects with exponential backoff (1s to 30s). You'll see log messages like:

```
[claw-dash] Gateway disconnected — will reconnect
[claw-dash] Gateway connected — v1.2.3, 25 methods, 12 events
```

If reconnection loops persist, check that the gateway hasn't crashed or run out of resources.

## Startup Issues

### "Port 3939 is already in use"

Another process is using the port. Either:

- Stop the existing process: `lsof -ti :3939 | xargs kill`
- Use a different port: set `CLAW_DASH_PORT` in `.env.local`

### "Failed to initialize Next.js"

Usually a dependency issue. Try:

```bash
rm -rf node_modules .next
npm install
npm run dev
```

### Dev server lock file

If the dev server didn't shut down cleanly, a lock file at `.next/dev/lock` may prevent restart. Remove it:

```bash
rm .next/dev/lock
```

## UI Issues

### Dashboard shows "Offline" banner

The gateway connection was lost. The banner appears when `GatewayClient.isConnected` is `false`. It will automatically dismiss when the connection is restored.

If it persists:

1. Check that the gateway is still running
2. Look at the terminal where Claw Dash is running for error messages
3. Try restarting Claw Dash

### Session workspace shows no messages

- **New session:** If the session was just created, there may be no messages yet.
- **Gateway latency:** Chat history is fetched via `chat.history` RPC. If the gateway is slow, the transcript may take a moment to load.
- **SSE disconnection:** The live chat stream uses Server-Sent Events. If the SSE connection drops, new messages won't appear until the page is refreshed.

### Topology graph is empty

The topology graph visualizes agents, sessions, and channels. If it's empty:

- No agents are registered with the gateway
- The gateway connection is down (no data to visualize)

### Stale data / queries not refreshing

Most queries refetch on a 5-second interval. If data seems stale:

- Check the browser's network tab for failing `/api/trpc` requests
- Hard-refresh the page (`Cmd+Shift+R` / `Ctrl+Shift+R`)
- Verify the gateway is responding (check terminal logs)

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | Gateway not running or wrong URL | Start gateway, check `OPENCLAW_GATEWAY_URL` |
| `EADDRINUSE` | Port already in use | Kill existing process or change `CLAW_DASH_PORT` |
| `Request ... timed out after 30000ms` | Gateway didn't respond to an RPC call | Check gateway health, may be overloaded |
| `WebSocket error` | Network-level connection failure | Check network, firewall, gateway status |
| `Gateway handshake failed: unknown` | Auth or protocol mismatch | Verify token, check gateway version |

## Debugging Tips

### Server-side logs

Claw Dash logs to stdout/stderr with a `[claw-dash]` prefix. Key log messages:

```
[claw-dash] Ready on http://localhost:3939          # Server started
[claw-dash] Gateway connected — v1.2.3, ...         # Connected to gateway
[claw-dash] Gateway disconnected — will reconnect    # Lost connection
[claw-dash] Gateway error: <message>                 # Connection error
```

### Browser developer tools

- **Console:** Check for React errors or failed API calls
- **Network tab:** Filter by `/api/trpc` to see tRPC requests and responses
- **EventSource:** Filter by `/api/stream` to see SSE chat events

### Gateway probe

The probe script (`npm run probe`) is the fastest way to diagnose gateway connectivity issues without starting the full application:

```bash
npm run probe
```

It tests WebSocket connection, protocol handshake, and a basic RPC call, reporting the result of each step.

## FAQ

**Q: Can I run Claw Dash on a different machine from the gateway?**

Yes. Set `OPENCLAW_GATEWAY_URL` to point to the remote gateway (e.g., `ws://192.168.1.100:18789`). You'll also need to set `OPENCLAW_GATEWAY_TOKEN` since the loopback auth bypass won't apply on a remote connection.

**Q: Does Claw Dash store any data?**

No. All data comes from the gateway in real-time. The only local state is an in-memory ring buffer of the last 1,000 gateway events (for the activity stream), which is lost on restart.

**Q: Can multiple users access Claw Dash simultaneously?**

Yes. Claw Dash is a standard web application — multiple browsers can connect to it. They all share the same gateway connection server-side. There is no user authentication built into Claw Dash itself (add it at the reverse proxy level if needed).

**Q: How do I update Claw Dash?**

```bash
git pull
npm install
npm run build    # if running in production
# Restart the server
```

**Q: What Node.js versions are supported?**

Node.js 20 or later. The project uses modern JavaScript features and ESM imports that require recent Node.js versions.
