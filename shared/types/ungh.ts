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
