type OutputStream = {
    write: (message: string) => unknown
}

/** Minimal node:console shim for Undici's unused mock-interceptor formatter. */
export class Console {
    readonly #stdout?: OutputStream

    constructor(stdoutOrOptions?: OutputStream | { stdout?: OutputStream }) {
        this.#stdout =
            stdoutOrOptions && 'stdout' in stdoutOrOptions
                ? stdoutOrOptions.stdout
                : (stdoutOrOptions as OutputStream | undefined)
    }

    table(value: unknown) {
        if (!this.#stdout) {
            globalThis.console.table(value)
            return
        }

        this.#stdout.write(`${JSON.stringify(value, null, 2)}\n`)
    }
}
