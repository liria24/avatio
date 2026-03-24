import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    getGithubContributors,
    getGithubItem,
    getGithubLatestRelease,
    getGithubReadme,
    getGithubRepo,
    getGithubUser,
} from '../../server/utils/github'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

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
// Helpers
// ---------------------------------------------------------------------------

/** Makes $fetch respond differently based on the URL suffix. */
const setupItemFetch = () => {
    mockFetch.mockImplementation((url: string) => {
        if (url.includes('/contributors')) return Promise.resolve(MOCK_CONTRIBUTORS)
        if (url.includes('/releases/latest')) return Promise.resolve(MOCK_RELEASE)
        return Promise.resolve(MOCK_REPO)
    })
}

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

// ---------------------------------------------------------------------------
// getGithubItem
// ---------------------------------------------------------------------------

describe('getGithubItem', () => {
    beforeEach(() => {
        mockFetch.mockClear()
        setupItemFetch()
    })

    it('returns null for an invalid repo string', async () => {
        mockFetch.mockClear()
        expect(await getGithubItem('not-a-repo')).toBeNull()
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns null when the repo fetch fails', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/contributors')) return Promise.resolve(MOCK_CONTRIBUTORS)
            if (url.includes('/releases/latest')) return Promise.resolve(MOCK_RELEASE)
            return Promise.reject(new Error('Not found'))
        })
        expect(await getGithubItem('octocat/hello-world')).toBeNull()
    })

    it('returns a correctly structured item', async () => {
        const result = await getGithubItem('octocat/hello-world')
        expect(result).toMatchObject({
            id: 'octocat/hello-world',
            platform: 'github',
            category: 'other',
            outdated: false,
            image: null,
            niceName: null,
            price: null,
            nsfw: false,
            likes: MOCK_REPO.repo.stars,
            forks: MOCK_REPO.repo.forks,
            version: MOCK_RELEASE.release.tag,
        })
    })

    it('sorts contributors by contribution count descending', async () => {
        const result = await getGithubItem('octocat/hello-world')
        expect(result?.contributors?.map((c: { name: string }) => c.name)).toEqual([
            'octocat',
            'ghost',
        ])
    })

    it('builds the shop from the repo owner', async () => {
        const result = await getGithubItem('octocat/hello-world')
        expect(result?.shop).toEqual({
            id: 'octocat',
            name: 'octocat',
            image: 'https://github.com/octocat.png',
            platform: 'github',
            verified: false,
        })
    })
})
