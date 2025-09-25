# AGENTS.md

## Stacks

Most of these are provided by MCP servers via Context7.

- Node.js v22
- Bun (Package Manager)
- Nuxt 4
- TailwindCSS v4
- TypeScript
- Zod
- Neon postgres
- Drizzle ORM
- Cloudflare R2
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
    - Enter the icon name in the name directive (e.g. name="lucide:arrow-right")
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
