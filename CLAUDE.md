# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An AI-powered storefront chat widget for Shopify stores. Customers interact with Claude AI to search products, manage carts, track orders, and ask store-related questions. The app uses the Model Context Protocol (MCP) to communicate with Shopify APIs.

**Reference implementation**: [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent)
**Official tutorial**: [Build a Storefront AI Agent](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent?framework=reactRouter)

This project (`shop-chat-agent-rinfit2`) is a customized fork deployed to Fly.io at `https://shop-chat-agent-rinfit2.fly.dev`.

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
  - Storefront MCP (product search, catalog, policies) — unauthenticated
  - Customer Account MCP (orders, cart, authenticated actions) — requires OAuth/PKCE
- OAuth/PKCE flow for customer authentication
- SQLite database via Prisma for sessions, conversations, and messages

**Frontend** (`extensions/chat-bubble/`): Shopify theme extension with the customer-facing chat UI. Assets in `extensions/chat-bubble/assets/` are vanilla JS/CSS (no external dependencies) injected into merchant storefronts via Liquid blocks.

### Request Flow

1. Customer sends message → `app/routes/chat.jsx` (POST)
2. `app/services/claude.server.js` calls Claude with system prompt + conversation history
3. Claude requests MCP tools → `app/services/tool.server.js` invokes them via `app/mcp-client.js`
4. Responses stream back via SSE to the chat bubble extension

### SSE Stream Events

The backend sends these named events to the frontend:

| Event | Payload | Description |
|-------|---------|-------------|
| `id` | `conversationId` | Conversation ID for session continuity |
| `chunk` | text delta | Streaming text from Claude |
| `message_complete` | — | Claude message finished |
| `tool_use` | `{toolName, toolArgs}` | Tool invocation info |
| `end_turn` | — | End of turn signal |
| `product_results` | product array | Product search results to display as cards |
| `content_block_complete` | — | Content block completion |
| `error` | message | Error occurred |
| `rate_limit_exceeded` | — | Claude API rate limit |
| `auth_required` | `authUrl` | Customer login needed |

### Key Files

| File | Purpose |
|------|---------|
| `app/routes/chat.jsx` | Main chat endpoint (GET for SSE setup/history, POST for messages) |
| `app/services/claude.server.js` | Claude API streaming service (`createClaudeService` factory) |
| `app/services/tool.server.js` | MCP tool invocation logic (`createToolService` factory) |
| `app/services/config.server.js` | Centralized config: model, max tokens, prompt type, tool names |
| `app/services/streaming.server.js` | SSE streaming utilities |
| `app/mcp-client.js` | MCP client managing both Shopify API connections |
| `app/auth.server.js` | OAuth/PKCE authentication for customer accounts |
| `app/db.server.js` | All database queries (conversations, messages, tokens) |
| `app/shopify.server.js` | Shopify API initialization |
| `app/prompts/prompts.json` | System prompts (`standardAssistant`) |
| `extensions/chat-bubble/assets/chat.js` | Frontend chat widget (933 lines, IIFE, no deps) |
| `extensions/chat-bubble/assets/chat.css` | Chat widget styles |
| `extensions/chat-bubble/blocks/chat-interface.liquid` | Shopify theme block (injects JS/CSS) |

### MCP Client (`app/mcp-client.js`)

`MCPClient` class manages JSON-RPC 2.0 connections to both Shopify MCP servers:

- **Constructor params**: `hostUrl`, `conversationId`, `shopId`, `customerMcpEndpoint` (optional)
- `connectToStorefrontServer()` — fetches storefront tools (no auth)
- `connectToCustomerServer()` — fetches customer tools with OAuth token from DB
- `callTool(toolName, toolArgs)` — routes to appropriate server
- `callStorefrontTool()` — unauthenticated storefront API calls
- `callCustomerTool()` — authenticated calls; returns `auth_required` event on 401
- `_makeJsonRpcRequest()` — low-level HTTP JSON-RPC
- `_formatToolsData()` — normalizes tool metadata across API response formats

Auth token retrieved from DB via `CustomerToken` model; on 401, generates auth URL via `generateAuthUrl()` in `auth.server.js`.

### Claude Service (`app/services/claude.server.js`)

- Model: `claude-sonnet-4-20250514`
- Max tokens: 2000
- Streams conversation using Anthropic SDK event handlers: `text`, `message`, `toolUse`, `contentBlock`
- System prompt pulled from `prompts.json` by `promptType` (default: `standardAssistant`)

### Tool Service (`app/services/tool.server.js`)

- `handleToolError()` — checks for auth requirements, appends error to history
- `handleToolSuccess()` — handles `search_shop_catalog` results specifically
- `processProductSearchResult()` — limits results to `maxProductsToDisplay` (default: 3)
- `formatProductData()` — transforms raw product to `{id, title, price, image_url, description, url}`
- `addToolResultToHistory()` — appends to history + persists to DB

### Config (`app/services/config.server.js`)

```javascript
{
  api: {
    defaultModel: 'claude-sonnet-4-20250514',
    maxTokens: 2000,
    promptType: 'standardAssistant'
  },
  tools: {
    productSearchName: "search_shop_catalog",
    maxProductsToDisplay: 3
  }
}
```

### Database Models (SQLite via Prisma)

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `Session` | Shopify admin session storage | Standard Shopify fields |
| `Conversation` | Chat session container | `id` (CUID), cascades to Messages |
| `Message` | Individual messages | `role` (user/assistant), `content`, `conversationId` |
| `CustomerToken` | OAuth tokens per conversation | `accessToken`, `conversationId` |
| `CodeVerifier` | PKCE verifiers | `state` (unique), `codeVerifier` |
| `CustomerAccountUrls` | MCP endpoint URLs per shop | `mcpApiUrl`, `authorizationUrl`, `tokenUrl` |

Migrations in `prisma/migrations/` — run with `npm run setup`.

### Frontend Chat Widget (`extensions/chat-bubble/assets/chat.js`)

Self-contained IIFE with these modules:

- **`ShopAIChat.UI`** — DOM management, mobile viewport fixes (iOS Safari), typing indicator, product grid display, auto-scroll
- **`ShopAIChat.Message`** — `send()` POSTs to `/chat`, `add()` appends to DOM, `addToolUse()` shows expandable tool info
- **`ShopAIChat.Formatting`** — Markdown → HTML (bold, lists, links), special auth URL handling
- **`ShopAIChat.API`** — SSE streaming via Reader API, event dispatcher, `fetchChatHistory()` on load
- **`ShopAIChat.Auth`** — Opens centered popup for Shopify OAuth, polls `/auth/token-status` every 10s (max 30 attempts), resumes conversation after auth
- **`ShopAIChat.Product`** — Creates product cards with "Add to Cart" button (sends message to agent)

### Theme Block Settings (merchant-configurable)

| Setting | Type | Default |
|---------|------|---------|
| `chat_bubble_color` | color | `#5046e4` |
| `welcome_message` | text | "👋 Hi there! How can I help you today?" |
| `server_url` | text | `https://shop-chat-agent-rinfit2.fly.dev` |

### MCP Tools Available

| User Input | MCP Tool |
|-----------|----------|
| Search for products | `search_shop_catalog` |
| Add item to cart | `update_cart` |
| View cart contents | `get_cart` |
| Store policies/FAQs | `search_shop_policies_and_faqs` |
| Recent orders | `get_most_recent_order_status` |
| Specific order | `get_order_status` |

## Tech Stack

- **Framework**: React Router 7 (full-stack, replaces Remix)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk` ^0.40.0) — model `claude-sonnet-4-20250514`
- **Database**: SQLite + Prisma ORM ^6.2.1
- **Shopify**: `@shopify/shopify-app-react-router` ^1.0.0, Shopify CLI
- **Build**: Vite 6
- **Node.js**: >=20.10 required

## Environment Variables

```
CLAUDE_API_KEY=        # Anthropic API key
SHOPIFY_API_KEY=       # App client ID (156927094d7cc2431f51e6a7e8fc55e5 in fly.toml)
REDIRECT_URL=          # OAuth callback URL (e.g., https://localhost:3458/auth/callback)
```

## Deployment

**Platform**: Fly.io (`fly.toml`, app: `shop-chat-agent-rinfit2`, region: `fra`)
- URL: `https://shop-chat-agent-rinfit2.fly.dev`
- 1GB RAM, 1 shared CPU
- `min_machines_running = 0` (scales to zero)

**Storage**: SQLite with Litestream replication (`litestream.yml`), mounted at `/data`
- Auto-extends up to 10GB

**Container**: `Dockerfile` — Node 20 Alpine, builds React Router app, prunes dev deps

**Start command**: `node ./dbsetup.js npm run start` (runs migrations, then starts server)

**Shopify scopes**: `unauthenticated_read_product_listings` (storefront) + customer data (Level 2) for order history

## Common Customizations

- **System prompt**: Edit `app/prompts/prompts.json` → `standardAssistant.content`
- **Model/tokens**: Edit `app/services/config.server.js`
- **Product display count**: `config.server.js` → `tools.maxProductsToDisplay`
- **Chat UI styling**: `extensions/chat-bubble/assets/chat.css`
- **Welcome message**: Theme block setting in Shopify admin (or `chat-interface.liquid` default)
- **Bubble color**: Theme block color picker in Shopify admin

## Auth Flow (Customer Accounts)

1. Claude calls a customer tool (orders, returns)
2. MCP server returns 401 → backend emits `auth_required` SSE event with `authUrl`
3. Frontend opens centered popup → customer logs in via Shopify OAuth/PKCE
4. Frontend polls `/auth/token-status` until token is stored in DB
5. Conversation resumes automatically with the customer's access token
