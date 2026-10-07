import { EventEmitter } from 'node:events'

import { runCloudflareNativeCommand } from '../../scripts/cloudflareNativePublication'

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', async (original) => ({
    ...(await original<typeof import('node:child_process')>()),
    spawn,
}))

const command = {
    executable: 'node' as const,
    args: ['node_modules/cf/bin/cf', 'd1', 'migrations', 'apply'],
}
const child = () => {
    const process = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
    })
    spawn.mockReturnValue(process)
    return process
}

afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe('bounded native CLI execution', () => {
    it('rejects the deadline even if successful JSON is captured and the killed process reports exit zero', async () => {
        vi.useFakeTimers()
        const process = child()
        process.kill.mockImplementation(() => process.emit('close', 0, null))
        const result = runCloudflareNativeCommand(command, '/tmp', {})
        const rejected = expect(result).rejects.toThrow('execution deadline')
        process.stdout.emit('data', Buffer.from('[{"name":"migration.sql","status":"✅"}]'))
        await vi.advanceTimersByTimeAsync(120_000)
        await rejected
        expect(process.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    })

    it('returns normally exited JSON while discarding stderr and clearing the deadline', async () => {
        vi.useFakeTimers()
        const process = child()
        const result = runCloudflareNativeCommand(command, '/tmp', {})
        process.stderr.emit('data', Buffer.from('PRIVATE_VALUE_DO_NOT_REPORT'))
        process.stdout.emit('data', Buffer.from('[]'))
        process.emit('close', 0, null)
        expect(await result).toEqual({ exitCode: 0, signal: null, output: [] })
        await vi.advanceTimersByTimeAsync(120_000)
        expect(process.kill).not.toHaveBeenCalled()
    })
})
