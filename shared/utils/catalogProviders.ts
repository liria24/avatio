const catalogProviders: Record<string, { icon: string; label: string }> = {
    booth: { icon: 'avatio:booth', label: 'BOOTH' },
    github: { icon: 'mingcute:github-fill', label: 'GitHub' },
}

export const getCatalogProviderData = (providerKey?: string) =>
    catalogProviders[providerKey ?? ''] ?? { icon: 'mingcute:box-3-fill', label: providerKey ?? '' }
