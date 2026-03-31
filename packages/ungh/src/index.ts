import type { $Fetch } from 'ofetch'
import { $fetch as ofetch } from 'ofetch'
import { z } from 'zod'

const UNGH_URL = 'https://ungh.cc'

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

export interface UnghOptions {
    fetcher?: $Fetch
}

export interface GithubRepo {
    repo: {
        id: number
        name: string
        repo: string
        description: string
        createdAt: string
        updatedAt: string
        pushedAt: string
        stars: number
        watchers: number
        forks: number
        defaultBranch: string
    }
}

export interface GithubReadme {
    html: string
    markdown: string
}

export interface GithubLatestRelease {
    release: {
        id: number
        tag: string
        author: string
        name: string
        draft: boolean
        prerelease: boolean
        createdAt: string
        publishedAt: string
        markdown: string
        html: string
    }
}

export interface GithubContributors {
    contributors: {
        id: number
        username: string
        contributions: number
    }[]
}

export interface GithubUser {
    user: {
        id: number
        name: string
        twitter: string | null
        username: string
        avatar?: string
    }
}

export const getGithubRepo = async (
    repo: string,
    options?: UnghOptions,
): Promise<GithubRepo | null> => {
    if (!validateRepo(repo)) return null
    const fetch = options?.fetcher ?? ofetch
    return fetch<GithubRepo>(`${UNGH_URL}/repos/${repo}`).catch(() => null)
}

export const getGithubContributors = async (
    repo: string,
    options?: UnghOptions,
): Promise<GithubContributors | null> => {
    if (!validateRepo(repo)) return null
    const fetch = options?.fetcher ?? ofetch
    return fetch<GithubContributors>(`${UNGH_URL}/repos/${repo}/contributors`).catch(() => null)
}

export const getGithubLatestRelease = async (
    repo: string,
    options?: UnghOptions,
): Promise<GithubLatestRelease | null> => {
    if (!validateRepo(repo)) return null
    const fetch = options?.fetcher ?? ofetch
    return fetch<GithubLatestRelease>(`${UNGH_URL}/repos/${repo}/releases/latest`).catch(() => null)
}

export const getGithubReadme = async (
    repo: string,
    options?: UnghOptions,
): Promise<GithubReadme | null> => {
    if (!validateRepo(repo)) return null
    const fetch = options?.fetcher ?? ofetch
    return fetch<GithubReadme>(`${UNGH_URL}/repos/${repo}/readme`).catch(() => null)
}

export const getGithubUser = async (
    username: string,
    options?: UnghOptions,
): Promise<GithubUser | null> => {
    if (!validateUser(username)) return null
    const fetch = options?.fetcher ?? ofetch
    return fetch<GithubUser>(`${UNGH_URL}/users/${username}`).catch(() => null)
}
