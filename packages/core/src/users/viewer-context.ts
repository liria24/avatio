export interface ViewerIdentity {
    id: string
    role: string | null
    banned: boolean
}

export interface ViewerPreferences {
    showPrivateSetups: boolean
    showNsfw: boolean
}

export interface ViewerCapabilities {
    administerUsers: boolean
    moderateCatalog: boolean
}

export interface ViewerContext {
    identity: ViewerIdentity | null
    preferences: ViewerPreferences
    capabilities: ViewerCapabilities
}
