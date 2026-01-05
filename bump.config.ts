import { defineConfig } from 'bumpp'

export default defineConfig({
    release: 'prompt',
    commit: true,
    tag: true,
    push: true,
    files: ['package.json', 'app/app.config.ts'],
})
