export const getFormError = (errors: readonly unknown[]) => {
    const error = errors[0]
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) return String(error.message)
    return undefined
}
