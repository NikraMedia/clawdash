# Deployment

Claw Dash is designed to run alongside your OpenClaw gateway, typically on the same machine or local network. This guide covers production deployment options.

## Prerequisites

- **Node.js** v20 or later
- **OpenClaw gateway** running and accessible over WebSocket
- Gateway auth token (set via env var or `~/.openclaw/.env`)

## Production Build

```bash
# Install dependencies
npm install

# Build the Next.js application
npm run build

# Start the production server
npm run start
```

The production server runs the same custom `server.ts` as development, with `NODE_ENV=production`. It listens on `127.0.0.1:3939` by default.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_GATEWAY_URL` | `ws://127.0.0.1:18789` | WebSocket URL of your OpenClaw gateway |
| `OPENCLAW_GATEWAY_TOKEN` | *(auto-resolved)* | Auth token. If not set, falls back to `GATEWAY_AUTH_TOKEN` in `~/.openclaw/.env` |
| `CLAW_DASH_PORT` | `3939` | Port for the Claw Dash server |
| `CLAW_DASH_ORIGIN` | `http://localhost:3939` | Origin header sent to gateway for auth bypass on loopback |

Create a `.env.local` file from the template:

```bash
cp .env.example .env.local
```

## Running with PM2

[PM2](https://pm2.io/) is a process manager that keeps Claw Dash running and restarts it on failure.

```bash
# Install PM2 globally
npm install -g pm2

# Start Claw Dash
pm2 start npm --name "claw-dash" -- run start

# Save the process list so it survives reboots
pm2 save
pm2 startup
```

Useful PM2 commands:

```bash
pm2 status          # Check if Claw Dash is running
pm2 logs claw-dash  # View logs
pm2 restart claw-dash
pm2 stop claw-dash
```

## Running with systemd

Create a service file at `/etc/systemd/system/claw-dash.service`:

```ini
[Unit]
Description=Claw Dash — OpenClaw Dashboard
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/claw-dash
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=CLAW_DASH_PORT=3939

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable claw-dash
sudo systemctl start claw-dash

# Check status
sudo systemctl status claw-dash

# View logs
journalctl -u claw-dash -f
```

## Reverse Proxy with nginx

If you want to serve Claw Dash behind nginx (e.g., for TLS or a custom domain):

```nginx
server {
    listen 443 ssl;
    server_name dash.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3939;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `Upgrade` and `Connection` headers are important — they allow Next.js hot-reload WebSocket connections to work in development. In production they're not strictly necessary but don't hurt.

> **Note:** Claw Dash connects to the OpenClaw gateway over a separate WebSocket connection server-side. The reverse proxy only affects the browser-to-Claw-Dash connection.

## Docker

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

ENV NODE_ENV=production
ENV CLAW_DASH_PORT=3939
EXPOSE 3939

CMD ["npm", "run", "start"]
```

Build and run:

```bash
docker build -t claw-dash .
docker run -d \
  --name claw-dash \
  -p 3939:3939 \
  -e OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789 \
  -e OPENCLAW_GATEWAY_TOKEN=your-token \
  claw-dash
```

> **Note:** Use `host.docker.internal` (Docker Desktop) or `--network host` (Linux) to reach a gateway running on the host machine. On Linux with `--network host`, Claw Dash can reach `ws://127.0.0.1:18789` directly.

## Health Checking

Use the gateway probe script to verify connectivity:

```bash
npm run probe
```

This performs a standalone WebSocket handshake and RPC test against the gateway without starting the full application. Useful for:

- Verifying gateway is reachable before starting Claw Dash
- Debugging connection issues
- CI/CD health checks

For runtime health monitoring, Claw Dash shows connection status in the UI — the topbar displays a gateway status indicator, and the home page shows health cards with real-time metrics.

## Security Considerations

- Claw Dash binds to `127.0.0.1` by default — it is **not** accessible from other machines unless you configure a reverse proxy
- The gateway auth token is sensitive — use environment variables or `~/.openclaw/.env`, never commit it to source control
- If exposing Claw Dash over a network, use TLS (via reverse proxy) and consider additional authentication at the proxy level
- The `Origin` header bypass is only effective on loopback — remote connections require proper token authentication
