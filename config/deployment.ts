import { z } from 'zod'

import type { AvatioStage } from './environment.ts'

export const stageActions = ['check', 'plan', 'deploy', 'adopt'] as const
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
    // Keep Nuxt's production build on Node in memory-limited Workers Builds containers.
    'node',
    'node_modules/alchemy/bin/alchemy.js',
    action === 'adopt' ? 'deploy' : action,
    '--stage',
    stage,
    ...(action === 'deploy' ? ['--yes'] : action === 'adopt' ? ['--adopt'] : []),
]

const pullRequestEvent = z.object({
    action: z.enum(['opened', 'synchronize', 'reopened', 'closed']),
    number: z.number().int().positive().safe(),
    pull_request: z.object({
        head: z.object({ repo: z.object({ full_name: z.string() }).nullable() }),
        base: z.object({
            ref: z.enum(['main', 'development']),
            repo: z.object({ full_name: z.string() }),
        }),
    }),
})

/** Target selection only. No credentials, resource changes, or deployment execution. */
export const getCloudflareDeliveryTarget = (input: {
    eventName: string
    event: unknown
    repository: string
    ref: string
    state: DeploymentState
}) => {
    if (input.eventName === 'pull_request') {
        const parsed = pullRequestEvent.safeParse(input.event)
        if (!parsed.success) return null
        const { action, number, pull_request: pr } = parsed.data
        if (
            pr.head.repo?.full_name !== input.repository ||
            pr.base.repo.full_name !== input.repository
        )
            return null
        return {
            mode: `pr-${number}`,
            isPreview: true,
            action: action === 'closed' ? 'cleanup' : 'deploy',
        } as const
    }
    if (!['push', 'workflow_dispatch'].includes(input.eventName)) return null
    if (input.ref === 'refs/heads/main') {
        validateDeployment('production', input.state)
        if (input.state.ci?.ref !== input.ref)
            throw new Error('GitHub ref must match the checked production deployment state.')
        return { mode: 'production', isPreview: false, action: 'deploy' } as const
    }
    if (input.ref === 'refs/heads/development')
        return { mode: 'development', isPreview: true, action: 'deploy' } as const
    return null
}
