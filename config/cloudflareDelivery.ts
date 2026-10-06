import type { DeploymentState } from './deployment.ts'
import { validateDeployment } from './deployment.ts'

interface CloudflareDeliveryEvidence {
    repository: string
    sourceRepository: string
    eventName: 'push' | 'workflow_dispatch' | 'workflow_run'
    ref: string
    mode: string
    sourceSha: string
    latestSourceSha: string
    trustedCodeSha: string
    checkedOutCodeSha: string
    trustedCodeRef: string
    buildSucceeded: boolean
    build: { sourceSha: string; mode: string; isPreview: boolean; workerName: string }
    state: DeploymentState
}

/** Publisher preparation only. The caller must separately verify real bindings and activation gates. */
export const validateCloudflareDeliveryEvidence = (input: CloudflareDeliveryEvidence) => {
    if (input.repository !== 'liria24/avatio') throw new Error('Untrusted delivery repository.')
    if (input.sourceRepository !== input.repository)
        throw new Error('Fork build outputs cannot receive deployment credentials.')
    const commits = [
        input.sourceSha,
        input.latestSourceSha,
        input.trustedCodeSha,
        input.checkedOutCodeSha,
        input.build.sourceSha,
    ]
    if (commits.some((sha) => !/^[a-f0-9]{40}$/.test(sha)))
        throw new Error('Full immutable commit identities are required.')
    if (input.sourceSha !== input.latestSourceSha || input.build.sourceSha !== input.sourceSha)
        throw new Error('Refusing stale or mismatched application output.')
    if (!input.buildSucceeded)
        throw new Error('Successful secretless build verification is required.')
    if (
        input.trustedCodeSha !== input.checkedOutCodeSha ||
        !['refs/heads/main', 'refs/heads/development'].includes(input.trustedCodeRef)
    )
        throw new Error('Privileged delivery must execute trusted base-branch code.')
    if (input.state.dirty || input.state.commit !== input.checkedOutCodeSha)
        throw new Error('Privileged code provenance must match the actual clean checkout.')
    const preview = input.mode !== 'production'
    if (!['production', 'development'].includes(input.mode) && !/^pr-[1-9]\d*$/.test(input.mode))
        throw new Error('Invalid native Preview target.')
    if (
        input.build.workerName !== 'avatio' ||
        input.build.mode !== input.mode ||
        input.build.isPreview !== preview
    )
        throw new Error('Build Output must match the one Worker and exact Preview context.')
    if (input.mode === 'production') {
        if (
            input.eventName === 'workflow_run' ||
            input.ref !== 'refs/heads/main' ||
            input.trustedCodeRef !== input.ref
        )
            throw new Error('Production requires an explicit main push or manual delivery.')
        validateDeployment('production', input.state)
        if (input.state.commit !== input.sourceSha || input.state.ci?.ref !== input.ref)
            throw new Error('Production output must match the actual main checkout and CI ref.')
    } else if (input.mode === 'development') {
        if (input.ref !== 'refs/heads/development')
            throw new Error('Persistent Preview requires development.')
    } else if (
        input.eventName !== 'workflow_run' ||
        input.ref !== `refs/pull/${input.mode.slice(3)}/head`
    ) {
        throw new Error(
            'PR delivery requires validated secretless build completion and exact PR identity.',
        )
    }
    return { mode: input.mode, isPreview: preview, workerName: 'avatio' as const }
}
