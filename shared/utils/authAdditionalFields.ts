export const authAdditionalFields = {
    bio: {
        type: 'string',
        required: false,
    },
    links: {
        type: 'string[]',
        required: false,
    },
    lastAgreedToTerms: {
        type: 'date',
        required: false,
    },
} as const
