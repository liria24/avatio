# AGENTS.md

## Stacks

Most of these are provided by MCP servers via Context7.

- Node.js v24
- Bun (Package Manager)
- Vite-plus (Oxfmt, Oxlint, Vitest)
- Nuxt 4
- TailwindCSS v4
- TypeScript
- Zod
- Neon postgres
- Drizzle ORM
- Tigris
- Better Auth
- Vercel

## Setup commands

- Install deps: `bun i`
- Start dev app: `bun dev`

## Code style

### TypeScript

- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible

### Vue

- Use the Composition API

## UI

Uses Nuxt UI as the framework.
Nuxt UI provides MCP server.

## Notes

- To use an icon in Vue, use the <Icon> component.
    - Enter the icon name in the name directive (e.g. name="mingcute:arrow-right-line")
    - Enter the icon size in the size directive (e.g. size="18")
- Nuxt 4 uses auto-importing. Elements exported in the following directories do not need to be explicitly imported:
    - app/composables
    - app/components
    - app/utils
    - shared/types
    - shared/utils
    - Specific Nuxt modules
- Please make sure the following is in English.
    - console.log
    - console.error
    - console.warn
- If you find any potential bugs, please fix them accordingly and suggest them.

## Logging

- Use `logger` from `server/utils/logger.ts` for all server-side logging. Do not use `console.log/error/warn` directly in server code.
- Declare a module-level constant: `const log = logger('tag')`, then call `log.info()`, `log.error()`, `log.warn()`.
- Tag naming — two accepted patterns (use whichever fits the context):
    - Route path style: `'/api/images:POST'`, `'/api/users/[username]:PUT'`
    - Function name style: `'createNotification'`, `'getItem'`

## Constants

- Define all global constants in `shared/utils/constants.ts`.
- Do not hardcode magic numbers or strings inline — always reference a named constant.

## Security

- Always check for injection risks (SQL, XSS, command injection) before writing any code that handles user input.
- Validate all API inputs with a Zod schema and the appropriate helper from `server/utils/validateRequest.ts`:
    - `validateQuery(schema)` — query parameters
    - `validateParams(schema)` — URL path parameters
    - `validateBody(schema)` — request body
    - `validateFormData(schema)` — form data
- For POST/PUT endpoints that accept user-supplied text, use `validateBody(schema, { sanitize: true })` to enable XSS sanitization.

## Server conventions

### API handlers

- Wrap every API handler with the appropriate factory from `server/utils/eventHandler.ts`:
    - `promiseEventHandler` — no auth required
    - `sessionEventHandler` — session available but optional (null-safe)
    - `authedSessionEventHandler` — login required (throws 401 if unauthenticated)
    - `adminSessionEventHandler` — admin only (throws 403)
    - `cronEventHandler` — cron jobs or admin

### Database

- Prefer Drizzle ORM query builder (`db.query.*`, `db.select()`, `db.insert()`, etc.) over raw `sql` template literals. Use `sql` only when the query builder cannot express the logic.
- For multi-statement writes, wrap in `db.transaction(async (tx) => { ... })` and use `tx.*` (not `db.*`) for all operations inside the callback.
- Group independent parallel inserts inside a transaction with `Promise.all([...].filter(Boolean))`.
