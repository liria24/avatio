import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getStageConfig, parseAvatioStage } from '../config/environment.ts'
import { validateSecrets } from '../config/secrets.ts'

const scriptPath = fileURLToPath(import.meta.url)
const stage = parseAvatioStage(process.argv[2] ?? '')

// Explicit owner config check only. No provider API, publisher, migration or resource adoption.
if (process.argv[3] !== '--validated-env') {
    const child = spawn(
        process.execPath,
        [
            join(
                dirname(scriptPath),
                '..',
                'node_modules',
                '@dotenvx',
                'dotenvx',
                'src',
                'cli',
                'dotenvx.js',
            ),
            'run',
            '--quiet',
            '--strict',
            '-f',
            join(process.cwd(), `.env.${stage}`),
            '--overload',
            '--',
            process.execPath,
            scriptPath,
            stage,
            '--validated-env',
        ],
        { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
    )
    child.on('error', () => {
        console.error('Stage configuration loader failed.')
        process.exit(1)
    })
    child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)))
} else {
    getStageConfig(stage)
    const result = validateSecrets(process.env)
    if (!result.success) {
        for (const issue of result.issues) console.error(`${issue.name}: ${issue.reason}`)
        process.exit(1)
    }
    console.info(`${stage} configuration is valid.`)
}
