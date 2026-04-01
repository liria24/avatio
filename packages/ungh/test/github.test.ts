import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    getGithubContributors,
    getGithubLatestRelease,
    getGithubReadme,
    getGithubRepo,
    getGithubUser,
} from '../src/index'

const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('ofetch', () => ({
    $fetch: mockFetch,
}))

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const MOCK_REPO = {
    repo: {
        repo: 'octocat/hello-world',
        name: 'Hello World',
        stars: 100,
        forks: 20,
    },
}

const MOCK_CONTRIBUTORS = {
    contributors: [
        { username: 'ghost', contributions: 10 },
        { username: 'octocat', contributions: 50 },
    ],
}

const MOCK_RELEASE = { release: { tag: 'v1.0.0' } }

const MOCK_USER = { user: { login: 'octocat', name: 'The Octocat' } }

const MOCK_README = { html: '<h1>Hello</h1>' }

// ---------------------------------------------------------------------------
// repo / user validation (shared by all functions)
// ---------------------------------------------------------------------------

describe('repo format validation', () => {
    it.each([
        ['missing slash', 'invalid'],
        ['empty string', ''],
        ['path traversal attempt', '../etc/passwd'],
        ['double slash', 'user//repo'],
    ])('getGithubRepo returns null for %s (%s)', async (_label, input) => {
        mockFetch.mockClear()
        expect(await getGithubRepo(input)).toBeNull()
        expect(mockFetch).not.toHaveBeenCalled()
    })
})

describe('user format validation', () => {
    it.each([
        ['slash in username', 'user/name'],
        ['empty string', ''],
        ['space in username', 'user name'],
    ])('getGithubUser returns null for %s (%s)', async (_label, input) => {
        mockFetch.mockClear()
        expect(await getGithubUser(input)).toBeNull()
        expect(mockFetch).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// getGithubRepo
// ---------------------------------------------------------------------------

describe('getGithubRepo', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        mockFetch.mockResolvedValue(MOCK_REPO)
    })

    it('calls the correct endpoint and returns the fetched data', async () => {
        const result = await getGithubRepo('octocat/hello-world')
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/repos/octocat/hello-world'),
        )
        expect(result).toEqual(MOCK_REPO)
    })

    it('returns null when the fetch throws', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))
        expect(await getGithubRepo('octocat/hello-world')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// getGithubContributors
// ---------------------------------------------------------------------------

describe('getGithubContributors', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        mockFetch.mockResolvedValue(MOCK_CONTRIBUTORS)
    })

    it('calls the correct endpoint', async () => {
        await getGithubContributors('octocat/hello-world')
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/repos/octocat/hello-world/contributors'),
        )
    })

    it('returns null when the fetch throws', async () => {
        mockFetch.mockRejectedValue(new Error('Not found'))
        expect(await getGithubContributors('octocat/hello-world')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// getGithubLatestRelease
// ---------------------------------------------------------------------------

describe('getGithubLatestRelease', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        mockFetch.mockResolvedValue(MOCK_RELEASE)
    })

    it('calls the correct endpoint', async () => {
        await getGithubLatestRelease('octocat/hello-world')
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/repos/octocat/hello-world/releases/latest'),
        )
    })

    it('returns null when the fetch throws', async () => {
        mockFetch.mockRejectedValue(new Error('Not found'))
        expect(await getGithubLatestRelease('octocat/hello-world')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// getGithubReadme
// ---------------------------------------------------------------------------

describe('getGithubReadme', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        mockFetch.mockResolvedValue(MOCK_README)
    })

    it('calls the correct endpoint', async () => {
        await getGithubReadme('octocat/hello-world')
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/repos/octocat/hello-world/readme'),
        )
    })

    it('returns null when the fetch throws', async () => {
        mockFetch.mockRejectedValue(new Error('Not found'))
        expect(await getGithubReadme('octocat/hello-world')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// getGithubUser
// ---------------------------------------------------------------------------

describe('getGithubUser', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        mockFetch.mockResolvedValue(MOCK_USER)
    })

    it('calls the correct endpoint and returns the fetched data', async () => {
        const result = await getGithubUser('octocat')
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/users/octocat'))
        expect(result).toEqual(MOCK_USER)
    })

    it('returns null when the fetch throws', async () => {
        mockFetch.mockRejectedValue(new Error('Not found'))
        expect(await getGithubUser('octocat')).toBeNull()
    })
})
