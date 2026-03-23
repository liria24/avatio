import { z } from 'zod'

const unghUrl = 'https://ungh.cc'

const validateRepo = (repo: string) =>
    z
        .string()
        .min(1)
        .regex(/^[\w-]+\/[\w.-]+$/)
        .safeParse(repo).success

const validateUser = (username: string) =>
    z
        .string()
        .min(1)
        .regex(/^[\w-]+$/)
        .safeParse(username).success

export const getGithubRepo = defineCachedFunction(
    async (repo: string) => {
        if (!validateRepo(repo)) return null

        const response = await $fetch<GithubRepo>(`${unghUrl}/repos/${repo}`).catch(() => null)
        return response
    },
    {
        maxAge: GITHUB_API_CACHE_TTL,
        name: 'ghRepo',
    },
)

export const getGithubContributors = defineCachedFunction(
    async (repo: string) => {
        if (!validateRepo(repo)) return null

        const response = await $fetch<GithubContributors>(
            `${unghUrl}/repos/${repo}/contributors`,
        ).catch(() => null)
        return response
    },
    {
        maxAge: GITHUB_API_CACHE_TTL,
        name: 'ghContributors',
    },
)

export const getGithubLatestRelease = defineCachedFunction(
    async (repo: string) => {
        if (!validateRepo(repo)) return null

        const response = await $fetch<GithubLatestRelease>(
            `${unghUrl}/repos/${repo}/releases/latest`,
        ).catch(() => null)
        return response
    },
    {
        maxAge: GITHUB_API_CACHE_TTL,
        name: 'ghLatestRelease',
    },
)

export const getGithubReadme = async (repo: string) => {
    if (!validateRepo(repo)) return null

    const response = await $fetch<GithubReadme>(`${unghUrl}/repos/${repo}/readme`).catch(() => null)
    return response
}

export const getGithubUser = defineCachedFunction(
    async (username: string) => {
        if (!validateUser(username)) return null

        const response = await $fetch<GithubUser>(`${unghUrl}/users/${username}`).catch(() => null)
        return response
    },
    {
        maxAge: GITHUB_API_CACHE_TTL,
        name: 'ghUser',
    },
)

type GithubItem = Omit<Item, 'outdated' | 'image' | 'niceName' | 'price' | 'nsfw'> & {
    platform: 'github'
    category: 'other'
    outdated: false
    image: null
    niceName: null
    price: null
    nsfw: false
}

export const getGithubItem = defineCachedFunction(
    async (repo: string): Promise<GithubItem | null> => {
        if (!validateRepo(repo)) return null

        const [repoData, contributors, latestRelease] = await Promise.all([
            getGithubRepo(repo),
            getGithubContributors(repo),
            getGithubLatestRelease(repo),
        ])

        if (!repoData) return null

        const owner = repoData.repo.repo.split('/')[0]!
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
        maxAge: GITHUB_API_CACHE_TTL,
        name: 'ghItem',
    },
)
