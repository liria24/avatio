// Setup drafts
export const MAX_SETUP_DRAFTS = 32

// Items per setup
export const MAX_ITEMS_PER_SETUP = 32

// API limits
export const API_LIMIT_MAX = 1000

// API default limits - Server side
export const SETUPS_API_DEFAULT_LIMIT = 64
export const ITEMS_API_DEFAULT_LIMIT = 64
export const SETUPS_BOOKMARKS_API_DEFAULT_LIMIT = 24
export const SETUP_TAGS_API_DEFAULT_LIMIT = 24
export const CHANGELOGS_API_DEFAULT_LIMIT = 24
export const POPULAR_AVATARS_API_DEFAULT_LIMIT = 24
export const OWNED_AVATARS_API_DEFAULT_LIMIT = 24
export const ADMIN_REPORTS_API_DEFAULT_LIMIT = 100
export const ADMIN_AUDIT_LOG_API_DEFAULT_LIMIT = 24

// Pagination - Client side
export const SETUP_SEARCH_PER_PAGE = 50
export const BOOKMARKS_PAGE_PER_PAGE = 50
export const USER_SETUPS_LIST_PER_PAGE = 50
export const BOOKMARKS_LIST_PER_PAGE = 50
export const LATEST_SETUPS_LIST_PER_PAGE = 64

// Cache duration
export const ITEM_CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
export const GITHUB_API_CACHE_TTL = 60 * 60 // 1 hour
export const SETUP_CACHE_TTL = 60 * 60 // 1 hour
export const USER_CACHE_TTL = 60 * 60 // 1 hour
export const ITEM_DATABASE_CACHE_TTL = 5 // 5 seconds
export const EDGE_CONFIG_CACHE_TTL = 5 // 5 seconds
export const SESSION_COOKIE_CACHE_MAX_AGE = 5 * 60 // 5 minutes

// Session settings
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 30 // 30 days
export const SESSION_UPDATE_AGE = 60 * 60 * 24 // 1 day
export const SESSION_FRESH_AGE = 60 * 15 // 15 minutes

// Rate limiting
export const RATE_LIMIT_WINDOW = 60 // seconds
export const RATE_LIMIT_DEFAULT = 100
export const RATE_LIMIT_SIGNIN = 10
export const RATE_LIMIT_SESSION = 200
