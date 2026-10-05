// Loaded only by the isolated test child process, before Nuxt or provider SDKs.
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import net from 'node:net'
import tls from 'node:tls'

const local = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
const rejectExternal = (input) => {
    const host =
        typeof input === 'string' || input instanceof URL
            ? new URL(input).hostname
            : (input?.hostname ?? input?.host?.split(':')[0] ?? 'localhost')
    if (!local(host)) throw new Error('Test fixture blocked outbound network access')
}
const fetchOriginal = globalThis.fetch
globalThis.fetch = (input, options) => {
    rejectExternal(input instanceof Request ? input.url : input)
    return fetchOriginal(input, options)
}
for (const transport of [http, https]) {
    for (const method of ['request', 'get']) {
        const original = transport[method]
        transport[method] = function (input, ...args) {
            rejectExternal(input)
            return original.call(this, input, ...args)
        }
    }
}
for (const transport of [net, tls]) {
    const original = transport.connect
    transport.connect = function (input, ...args) {
        if (typeof input === 'number')
            rejectExternal({ hostname: typeof args[0] === 'string' ? args[0] : 'localhost' })
        else if (typeof input === 'object' && !input.path) rejectExternal(input)
        return original.call(this, input, ...args)
    }
}
const socketConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
    const input = Array.isArray(args[0]) ? args[0][0] : args[0]
    if (typeof input === 'object' && !input.path) rejectExternal(input)
    else if (typeof input === 'number')
        rejectExternal({ hostname: typeof args[1] === 'string' ? args[1] : 'localhost' })
    return socketConnect.apply(this, args)
}
syncBuiltinESMExports()
