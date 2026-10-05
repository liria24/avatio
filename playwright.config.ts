import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/browser',
    outputDir: '.cache/playwright-results',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    globalTimeout: 15 * 60_000,
    workers: 1,
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    failOnFlakyTests: Boolean(process.env.CI),
    reporter: [['list'], ['html', { outputFolder: '.cache/playwright-report', open: 'never' }]],
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
    },
    projects: [
        {
            name: 'chromium-smoke',
            testMatch: 'smoke.spec.ts',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'chromium-extended',
            testMatch: 'extended.spec.ts',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            testMatch: 'smoke.spec.ts',
            grep: /login|content|private/,
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            testMatch: 'smoke.spec.ts',
            grep: /login|content|private/,
            use: { ...devices['Desktop Safari'] },
        },
        {
            name: 'mobile',
            testMatch: 'smoke.spec.ts',
            grep: /login|content|private|keyboard/,
            use: { ...devices['Pixel 7'], reducedMotion: 'reduce' },
        },
    ],
})
