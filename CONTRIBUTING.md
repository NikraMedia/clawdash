# Contributing to Claw Dash

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and configure your gateway connection
4. Start the dev server: `npm run dev`
5. Open [http://localhost:3939](http://localhost:3939)

You'll need a running [OpenClaw](https://github.com/openclaw) gateway for the dashboard to display data. Use `npm run probe` to verify gateway connectivity.

For a deeper understanding of how the codebase works, see the [Architecture](docs/architecture.md) guide.

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on `:3939` |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite |
| `npm run probe` | Test gateway connectivity |

**Note:** The dev server uses a custom `server.ts` (not the default `next dev`). It initializes the gateway WebSocket connection before accepting HTTP requests.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the coding conventions below
3. Run `npm run lint` and `npm run test` to verify your changes
4. Submit a pull request with a clear description of the problem and solution
5. Include before/after screenshots for any UI changes

## Coding Conventions

- **TypeScript + React** throughout
- **Components:** `PascalCase` names, `kebab-case.tsx` filenames
- **Styling:** Tailwind CSS v4 + shadcn/ui — avoid raw `style` attributes
- **Data fetching:** tRPC + TanStack React Query — follow existing router patterns
- **New tRPC procedures:** Zod input validation, thin pass-through to `GatewayClient` methods
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat(sessions): ...`, `fix(system): ...`)

## Reporting Issues

- Use GitHub Issues to report bugs or suggest features
- Include repro steps, expected behavior, and actual behavior
- Mention your Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
