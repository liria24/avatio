import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['src/client.ts'],
    format: 'esm',
    dts: true,
    clean: true,
})
