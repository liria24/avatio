type LogLevel = 'info' | 'warn' | 'error'

const emit = (level: LogLevel, message: string, fields?: Record<string, unknown>) => {
    const entry = JSON.stringify({ level, message, ...fields })
    if (level === 'error') console.error(entry)
    else if (level === 'warn') console.warn(entry)
    else console.log(entry)
}

export const logger = {
    info: (message: string, fields?: Record<string, unknown>) => emit('info', message, fields),
    warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, fields),
    error: (message: string, fields?: Record<string, unknown>) => emit('error', message, fields),
}
