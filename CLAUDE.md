# CLAUDE.md

@../_shared/informatica-store.md

Shopify app (Remix + Prisma/SQLite) that serves an AI chat widget on the storefront: backend in `app/` (chat endpoint `app/routes/chat.jsx`, MCP client `app/mcp-client.js`), theme app extension in `extensions/chat-bubble/`.

## Important Implementation Notes

- The system prompt is `app/prompts/standard-assistant.txt` (Ukrainian; the reply language is picked in code by `app/services/language.server.js`).
- Prompt budget: `standard-assistant.txt` must stay ≤ 8 KB (`wc -c`). A new rule must replace or shorten an existing one; don't add UA/RU/EN copies of phrases.
- Past turns are sent to Claude as text only (`dropPastToolOutput` in `app/routes/chat.jsx`); search/catalog results are re-billed only within the current message.
- Customer authentication uses the OAuth 2.0 PKCE flow.
- The frontend extension includes IP-based feature gating.

## Testing

No test framework. Test the `/chat` endpoint directly for API checks.

Mobile layout/keyboard behaviour can't be judged in desktop DevTools device mode — use the real-Android kit in `tools/mobile-research/README.md`.

## Deployment

Fly.io (Dockerfile) with Litestream replicating SQLite.

- **Backend (Remix app):** deployed manually with `fly deploy`; there is no CI deploy.
- **Chat widget (theme app extension):** `shopify app deploy` releases a new app version to the store; merging alone doesn't change the storefront.
