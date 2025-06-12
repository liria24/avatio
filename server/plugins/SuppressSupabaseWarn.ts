// このサーバープラグインは、Supabaseによる過剰な警告ログを抑制するものです。

export default defineNitroPlugin(() => {
    const originalConsoleWarn = console.warn

    console.warn = function (...args) {
        const shouldLog = args.every((arg) => {
            if (typeof arg === 'string') {
                return !arg.includes(
                    'Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange()'
                )
            }
            return true
        })
        if (shouldLog) {
            originalConsoleWarn.apply(console, args)
        }
    }
})
