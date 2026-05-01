import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        env: loadEnv('test', process.cwd(), ''),
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['test/unit/*.{test,spec}.ts'],
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./test/setup.ts'],
                },
            },
        ],
    },
})
