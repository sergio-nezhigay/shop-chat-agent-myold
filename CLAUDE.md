# CLAUDE.md

@../_shared/informatica-store.md

Shopify app (Remix + Prisma/SQLite) that serves an AI chat widget on the storefront: backend in `app/` (chat endpoint `app/routes/chat.jsx`, MCP client `app/mcp-client.js`), theme app extension in `extensions/chat-bubble/`.

## Important Implementation Notes

- System prompts are in `app/prompts/prompts.json`, in English and Ukrainian.
- Customer authentication uses the OAuth 2.0 PKCE flow.
- The frontend extension includes IP-based feature gating.

## Testing

No test framework. Test the `/chat` endpoint directly for API checks.

Mobile layout/keyboard behaviour can't be judged in desktop DevTools device mode — use the real-Android kit in `tools/mobile-research/README.md`.

## Deployment

Fly.io (Dockerfile) with Litestream replicating SQLite.

- **Backend (Remix app):** deployed manually with `fly deploy`. The GitHub "Fly Deploy" workflow runs on every push to `main` and fails because the repo has no `FLY_API_TOKEN` secret. That's expected; merging does not deploy the backend.
- **Chat widget (theme app extension):** `shopify app deploy` releases a new app version to the store; merging alone doesn't change the storefront.
