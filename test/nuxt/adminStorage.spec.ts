import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { StoredFile } from 'files-sdk'
import type { FilesClient } from 'files-sdk/vue'
import { expect, it, vi } from 'vitest'

import FilePreview from '~/components/filesSdk/filePreview.vue'

const deferred = () => {
    let resolve!: (file: StoredFile) => void
    const promise = new Promise<StoredFile>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

it('keeps the latest preview when an older download completes afterward', async () => {
    const first = deferred()
    const second = deferred()
    const download = vi.fn((key: string) => (key === 'first.txt' ? first.promise : second.promise))
    const files = { download } as unknown as FilesClient
    const file = (key: string) => ({ key, name: key, type: 'text/plain', size: 3 }) as StoredFile
    const wrapper = await mountSuspended(FilePreview, { props: { files } })

    await wrapper.setProps({ file: file('first.txt') })
    await wrapper.setProps({ file: file('second.txt') })
    expect(download).toHaveBeenCalledTimes(2)

    second.resolve({ text: async () => 'new content' } as StoredFile)
    await flushPromises()
    expect(wrapper.get('pre').text()).toBe('new content')

    first.resolve({ text: async () => 'old content' } as StoredFile)
    await flushPromises()
    expect(wrapper.get('pre').text()).toBe('new content')
    wrapper.unmount()
})
