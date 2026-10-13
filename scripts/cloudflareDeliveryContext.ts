type Checkout = { sourceSha: string; clean: boolean }

const requireCheckout = (sourceSha: string, checkout: Checkout) => {
    if (!/^[a-f0-9]{40}$/.test(sourceSha) || sourceSha !== checkout.sourceSha || !checkout.clean)
        throw new Error('Exact clean delivery checkout required.')
}

/** Platform filters must exclude PR/feature builds before credentials are available. */
export const getCloudflareBuildsContext = (environment: NodeJS.ProcessEnv, checkout: Checkout) => {
    const sourceSha = environment.WORKERS_CI_COMMIT_SHA ?? ''
    requireCheckout(sourceSha, checkout)
    if (
        environment.WORKERS_CI !== '1' ||
        environment.WORKERS_CI_BRANCH !== 'main' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
            environment.WORKERS_CI_BUILD_UUID ?? '',
        )
    )
        throw new Error('Production requires a main Workers Builds checkout.')
    return { stage: 'production' as const, sourceSha }
}

/** A separate real GitHub push context; never impersonate Workers Builds. */
export const getCloudflareDevelopmentContext = (
    environment: NodeJS.ProcessEnv,
    checkout: Checkout,
) => {
    const sourceSha = environment.GITHUB_SHA ?? ''
    requireCheckout(sourceSha, checkout)
    if (
        environment.GITHUB_ACTIONS !== 'true' ||
        environment.GITHUB_SERVER_URL !== 'https://github.com' ||
        environment.GITHUB_REPOSITORY !== 'liria24/avatio' ||
        environment.GITHUB_EVENT_NAME !== 'push' ||
        environment.GITHUB_REF !== 'refs/heads/development' ||
        environment.GITHUB_WORKFLOW_REF !==
            'liria24/avatio/.github/workflows/development.yml@refs/heads/development' ||
        !/^[1-9][0-9]*$/.test(environment.GITHUB_RUN_ID ?? '') ||
        environment.WORKERS_CI
    )
        throw new Error('Development requires the development-only GitHub push workflow.')
    return { stage: 'development' as const, sourceSha }
}
