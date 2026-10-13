import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'

import CopyableButton from '~/components/copyableButton.vue'

const copyMock = vi.fn()
const copiedMock = ref(false)

mockNuxtImport('useClipboard', () => () => ({
    copy: copyMock,
    copied: copiedMock,
}))

describe('CopyableButton', () => {
    it('calls copy() with the value on click', async () => {
        copyMock.mockClear()
        const wrapper = await mountSuspended(CopyableButton, {
            props: { label: 'Copy test', value: 'copied-value' },
        })
        expect(wrapper.text()).toContain('Copy test')
        await wrapper.trigger('click')
        expect(copyMock).toHaveBeenCalledWith('copied-value')
    })

    it('does not call copy() when copyable is false', async () => {
        copyMock.mockClear()
        const wrapper = await mountSuspended(CopyableButton, {
            props: { label: 'No copy', copyable: false },
        })
        await wrapper.trigger('click')
        expect(copyMock).not.toHaveBeenCalled()
    })
})
