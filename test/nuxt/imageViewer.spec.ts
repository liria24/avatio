import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, expect, it, vi } from 'vitest'

import ImageViewer from '~/components/imageViewer.vue'

afterEach(() =>
    document.querySelectorAll('[data-viewer-test]').forEach((element) => element.remove()),
)

it('names the fullscreen dialog and restores the initiating control after closing and reopening', async () => {
    const launcher = document.createElement('button')
    launcher.dataset.viewerTest = ''
    launcher.textContent = 'Open image'
    document.body.append(launcher)
    const wrapper = await mountSuspended(ImageViewer, {
        props: { src: '/test.png', alt: 'Portrait', open: false },
        attachTo: document.body,
    })
    for (const alt of ['Portrait', 'Landscape']) {
        launcher.focus()
        await wrapper.setProps({ open: true, alt })
        await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
        const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)
        expect(title?.textContent).toBe(alt)
        const close = dialog.querySelector<HTMLButtonElement>('button')!
        await vi.waitFor(() => expect(document.activeElement).toBe(close))
        expect(close.getAttribute('aria-label')).toBeTruthy()
        close.click()
        await vi.waitFor(() => expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]))
        await wrapper.setProps({ open: false })
        await vi.waitFor(() => expect(document.activeElement).toBe(launcher))
    }
    wrapper.unmount()
})
