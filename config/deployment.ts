import type { AvatioStage } from './environment'

export const stageActions = ['check', 'dev', 'plan', 'deploy', 'adopt'] as const
export type StageAction = (typeof stageActions)[number]

export interface DeploymentState {
    branch: string | null
    commit: string
    dirty: boolean
    ci?: { branch?: string; ref?: string; commit?: string }
}

export const validateDeployment = (stage: AvatioStage, state: DeploymentState) => {
    if (stage !== 'production') return
    if (state.dirty) throw new Error('Refusing production deployment from a dirty working tree.')
    if (state.branch !== 'main' && !(state.branch === null && state.ci))
        throw new Error('Production deployment requires the main branch.')
    if (state.ci) {
        const { branch, ref, commit } = state.ci
        if (
            (!branch && !ref) ||
            (branch && branch !== 'main') ||
            (ref && ref !== 'refs/heads/main')
        )
            throw new Error('Production CI branch/ref must identify main.')
        if (!commit || commit !== state.commit)
            throw new Error('Production CI commit must match the checked-out git commit.')
    }
}

export const alchemyCommand = (action: Exclude<StageAction, 'check'>, stage: AvatioStage) => [
    'bunx',
    'alchemy',
    action === 'adopt' ? 'deploy' : action,
    '--stage',
    stage,
    ...(action === 'deploy' ? ['--yes'] : action === 'adopt' ? ['--adopt'] : []),
]
