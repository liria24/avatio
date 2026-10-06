import type { AvatioStage } from './environment.ts'

// Legacy publisher command composition. Remove this module only after native delivery cutover.
export const stageActions = ['check', 'plan', 'deploy', 'adopt'] as const
export type StageAction = (typeof stageActions)[number]

export const alchemyCommand = (action: Exclude<StageAction, 'check'>, stage: AvatioStage) => [
    // Keep Nuxt's production build on Node in memory-limited Workers Builds containers.
    'node',
    'node_modules/alchemy/bin/alchemy.js',
    action === 'adopt' ? 'deploy' : action,
    '--stage',
    stage,
    ...(action === 'deploy' ? ['--yes'] : action === 'adopt' ? ['--adopt'] : []),
]
