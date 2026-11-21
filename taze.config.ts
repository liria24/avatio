import { defineConfig } from 'taze'

export default defineConfig({
    force: true,
    write: true,
    install: false,
    interactive: true,
    recursive: true,
    includeLocked: true,
    ignorePaths: ['**/node_modules/**', '**/.data/**', '**/.output/**'],
    ignoreOtherWorkspaces: true,
    depFields: {
        overrides: false,
    },
})
