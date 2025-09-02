import { z } from 'zod'

const validateRepo = (repo: string) => {
    const idSchema = z
        .string()
        .min(1)
        .regex(/^[\w-]+\/[\w.-]+$/)

    return idSchema.safeParse(repo).success
}

const validateUser = (username: string) => {
    const idSchema = z
        .string()
        .min(1)
        .regex(/^[\w-]+$/)

    return idSchema.safeParse(username).success
}

export const getGithubRepo = defineCachedFunction(
    async (repo: string) => {
        if (!validateRepo(repo)) return null

        const response = await $fetch<GithubRepo>(
            `https://ungh.cc/repos/${repo}`
        ).catch(() => null)
        return response
    },
    {
        maxAge: 60 * 60,
        name: 'ghRepo',
    }
)

export const getGithubContributors = defineCachedFunction(
    async (repo: string) => {
        if (!validateRepo(repo)) return null

        const response = await $fetch<GithubContributors>(
            `https://ungh.cc/repos/${repo}/contributors`
        ).catch(() => null)
        return response
    },
    {
        maxAge: 60 * 60,
        name: 'ghContributors',
    }
)

export const getGithubLatestRelease = defineCachedFunction(
    async (repo: string) => {
        if (!validateRepo(repo)) return null

        const response = await $fetch<GithubLatestRelease>(
            `https://ungh.cc/repos/${repo}/releases/latest`
        ).catch(() => null)
        return response
    },
    {
        maxAge: 60 * 60,
        name: 'ghLatestRelease',
    }
)

export const getGithubReadme = async (repo: string) => {
    if (!validateRepo(repo)) return null

    const response = await $fetch<GithubReadme>(
        `https://ungh.cc/repos/${repo}/readme`
    ).catch(() => null)
    return response
}

export const getGithubUser = defineCachedFunction(
    async (username: string) => {
        if (!validateUser(username)) return null

        const response = await $fetch<GithubUser>(
            `https://ungh.cc/users/${username}`
        ).catch(() => null)
        return response
    },
    {
        maxAge: 60 * 60,
        name: 'ghUser',
    }
)

export const getGithubItem = defineCachedFunction(
    async (repo: string): Promise<Item | null> => {
        if (!validateRepo(repo)) return null

        const [repoData, contributors, latestRelease] = await Promise.all([
            getGithubRepo(repo),
            getGithubContributors(repo),
            getGithubLatestRelease(repo),
        ])

        if (!repoData) return null

        const owner = repoData.repo.repo.split('/')[0]
        const shop = {
            id: owner,
            name: owner,
            image: `https://github.com/${owner}.png`,
            platform: 'github' as const,
            verified: false,
        }

        return {
            id: repoData.repo.repo,
            platform: 'github' as const,
            name: repoData.repo.name,
            category: 'other' as const,
            outdated: false,
            image: null,
            niceName: null,
            price: null,
            nsfw: false,
            likes: repoData.repo.stars,
            forks: repoData.repo.forks,
            version: latestRelease?.release.tag,
            contributors: contributors?.contributors
                .sort((a, b) => b.contributions - a.contributions)
                .map((c) => ({
                    name: c.username,
                    contributions: c.contributions,
                })),
            shop,
        }
    },
    {
        maxAge: 60 * 60,
        name: 'ghItem',
    }
)
