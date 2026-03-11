# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An AI-powered storefront chat widget for Shopify stores. Customers interact with Claude AI to search products, manage carts, track orders, and ask store-related questions. The app uses the Model Context Protocol (MCP) to communicate with Shopify APIs.

## Commands

```bash
# Development
npm run dev          # Start dev server with Shopify CLI tunneling (--use-localhost --reset)

# Build & Type Checking
npm run build        # react-router build
npm run typecheck    # react-router typegen && tsc --noEmit
npm run lint         # ESLint with caching

# Database
npm run setup        # prisma generate && prisma migrate deploy

# Deployment
npm run deploy       # shopify app deploy
npm run docker-start # npm run setup && npm run start (for container deployments)
```

There are no unit tests in this codebase.

## Architecture

### Two Main Components

**Backend** (`app/`): React Router 7 server (Node.js) handling:
- Claude API communication with streaming SSE responses
- MCP client connecting to two Shopify MCP endpoints:
  - Storefront MCP (product search, catalog, policies)
  - Customer Account MCP (orders, cart, authenticated actions)
- OAuth/PKCE flow for customer authentication
- SQLite database via Prisma for sessions, conversations, and messages

**Frontend** (`extensions/chat-bubble/`): Shopify theme extension with the customer-facing chat UI. Assets in `extensions/chat-bubble/assets/` are vanilla JS/CSS injected into merchant storefronts via Liquid blocks.

### Request Flow

1. Customer sends message → `app/routes/chat.jsx` (POST)
2. `app/services/claude.server.js` calls Claude with system prompt + conversation history
3. Claude requests MCP tools → `app/services/tool.server.js` invokes them via `app/mcp-client.js`
4. Responses stream back via SSE to the chat bubble extension

### Key Files

| File | Purpose |
|------|---------|
| `app/routes/chat.jsx` | Main chat endpoint (GET for SSE setup, POST for messages) |
| `app/services/claude.server.js` | Claude API streaming service |
| `app/services/tool.server.js` | MCP tool invocation logic |
| `app/mcp-client.js` | MCP client managing both Shopify API connections |
| `app/auth.server.js` | OAuth/PKCE authentication for customer accounts |
| `app/db.server.js` | All database queries (conversations, messages, tokens) |
| `app/shopify.server.js` | Shopify API initialization |
| `app/prompts/prompts.json` | System prompts (`standardAssistant`, `enthusiasticAssistant`) |
| `app/services/config.server.js` | Centralized configuration (model name, API keys, etc.) |

### Database Models (SQLite via Prisma)

- `Session`: Shopify admin session storage
- `Conversation`: Chat conversation containers
- `Message`: Individual messages with role (user/assistant)
- `CustomerToken`: OAuth tokens tied to conversations
- `CodeVerifier`: PKCE code verifiers for auth flows
- `CustomerAccountUrls`: MCP endpoint URLs per conversation

## Tech Stack

- **Framework**: React Router 7 (full-stack, replaces Remix)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — model configured in `config.server.js`
- **Database**: SQLite + Prisma ORM
- **Shopify**: `@shopify/shopify-app-react-router`, Shopify CLI
- **Build**: Vite 6

## Environment Variables

```
CLAUDE_API_KEY=        # Anthropic API key
SHOPIFY_API_KEY=       # App client ID
REDIRECT_URL=          # OAuth callback URL (e.g., https://localhost:3458/auth/callback)
```

## Deployment

Container-ready with `Dockerfile` and `fly.toml` for Fly.io. SQLite replication handled by Litestream (`litestream.yml`). The `npm run docker-start` script runs migrations then starts the server.
