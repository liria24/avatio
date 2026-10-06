import { z } from 'zod'

import { validateDeployment, type DeploymentState } from './deployment.ts'

const handoff = z.strictObject({
    sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
    applicationWorkers: z.tuple([z.literal('avatio')]),
    automaticPublishers: z.tuple([z.literal('github-actions-native')]),
    workersBuildTriggers: z.tuple([]),
    developmentPreview: z.object({
        name: z.literal('development'),
        deploymentId: z.string().min(1),
        verified: z.literal(true),
    }),
    populatedMigrationsVerified: z.literal(true),
    freshMigrationsVerified: z.literal(true),
    previewLifecycleAndSecretsVerified: z.literal(true),
    productionVersionVerified: z.literal(true),
    recoveryRehearsed: z.literal(true),
    legacyDataResourcesRetained: z.literal(true),
    evidenceUrl: z.url().refine((url) => url.startsWith('https://')),
})

/** Repository retirement scope only, after the observed one-Worker transition. No file/cloud deletion. */
export const prepareCloudflareLegacyRetirement = (input: unknown, state: DeploymentState) => {
    validateDeployment('production', state)
    const result = handoff.safeParse(input)
    if (!result.success || result.data.sourceSha !== state.commit)
        throw new Error(
            'Verified native handoff is incomplete; retain active Alchemy and all legacy data.',
        )
    return {
        sourceSha: state.commit,
        files: ['alchemy.run.ts', 'config/alchemyDeployment.ts', 'scripts/stage.ts'],
        dependencies: ['alchemy', '@alchemy.run/frontend-frameworks', '@effect/platform-bun'],
        reviewSharedDependencyUsage: ['effect'],
        update: ['package.json', 'bun.lock', 'AGENTS.md'],
        userMaintainedDocument: 'README.md',
        dataResourceDeletion: false as const,
        workerDeletion: false as const,
        executionEnabled: false as const,
    }
}
