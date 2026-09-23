// @vitest-environment happy-dom
import { parents } from '@formkit/drag-and-drop'
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import SortableList from '~/components/sortableList.vue'

it('connects FormKit sorting to v-model and tears down listeners', async () => {
    const update = vi.fn()
    const wrapper = mount(SortableList, {
        props: {
            modelValue: ['first', 'second'],
            handle: '.handle',
            'onUpdate:modelValue': update,
        },
        slots: {
            default: '<div><button class="handle">First</button></div><div>Second</div>',
        },
    })
    await nextTick()

    const parent = wrapper.element as HTMLElement
    const data = parents.get(parent)
    expect(data?.config).toMatchObject({
        dragHandle: '.handle',
        draggingClass: 'opacity-100',
        dragPlaceholderClass: 'opacity-0',
    })

    data?.setValues(['second', 'first'], parent)
    expect(update).toHaveBeenCalledWith(['second', 'first'])

    const controller = data?.abortControllers.mainParent
    wrapper.unmount()
    expect(controller?.signal.aborted).toBe(true)
})
