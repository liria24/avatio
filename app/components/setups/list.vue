<script lang="ts" setup>
import { MasonryWall } from '@yeger/vue-masonry-wall'
import type { ObjectDirective } from 'vue'

import type { SetupEntranceBatch } from '~/composables/setupEntrance'

interface Props {
    setups?: ReturnType<typeof useSetupsList>['setups']['value']
    loading?: boolean
    entrance?: Map<string, SetupEntranceBatch>
}
const { setups = [], loading = false, entrance } = defineProps<Props>()

const { isMobile } = useDevice()
let observer: IntersectionObserver | undefined
const waiting = new Map<HTMLElement, () => void>()
const running = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
const motion = usePreferredReducedMotion()
function release(element: HTMLElement) {
    observer?.unobserve(element)
    waiting.delete(element)
    element.classList.remove('setup-card-waiting')
    element.removeEventListener('focusin', focus)
    if (!waiting.size) {
        observer?.disconnect()
        observer = undefined
    }
}
function focus(event: Event) {
    const element = event.currentTarget as HTMLElement
    waiting.get(element)?.()
    finish(element)
}
function finish(element: HTMLElement) {
    release(element)
    clearTimeout(running.get(element))
    running.delete(element)
    element.classList.remove('setup-card-enter')
}
function bindEntrance(element: HTMLElement, value: string) {
    const batch = entrance?.get(value)
    if (!batch || waiting.has(element)) return
    const start = () => {
        entrance?.delete(value)
        release(element)
        if (motion.value !== 'reduce') {
            element.style.animationDelay = `${batch.delay}ms`
            element.classList.add('setup-card-enter')
            element.addEventListener('focusin', focus)
            running.set(
                element,
                setTimeout(() => finish(element), batch.delay + 180),
            )
        }
    }
    if (!batch.appended || motion.value === 'reduce' || typeof IntersectionObserver === 'undefined')
        return start()
    observer ??= new IntersectionObserver((entries) => {
        for (const entry of entries)
            if (entry.isIntersecting) waiting.get(entry.target as HTMLElement)?.()
    })
    waiting.set(element, start)
    element.classList.add('setup-card-waiting')
    element.addEventListener('focusin', focus)
    observer.observe(element)
}
const vEntrance: ObjectDirective<HTMLElement, string> = {
    getSSRProps({ value }) {
        const batch = entrance?.get(value)
        return batch
            ? { class: 'setup-card-enter', style: { animationDelay: `${batch.delay}ms` } }
            : {}
    },
    mounted: (element, { value }) => bindEntrance(element, value),
    updated: (element, { value }) => bindEntrance(element, value),
    beforeUnmount: finish,
}
watch(motion, (value) => {
    if (value === 'reduce') {
        for (const start of [...waiting.values()]) start()
        for (const element of running.keys()) finish(element)
    }
})
onBeforeUnmount(() => {
    for (const element of waiting.keys()) finish(element)
    for (const element of running.keys()) finish(element)
})
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <Icon
            v-if="loading && !setups?.length"
            name="svg-spinners:ring-resize"
            size="24"
            class="mt-4 self-center bg-zinc-500"
        />

        <p v-else-if="!setups?.length" class="text-muted mt-4 self-center text-center text-sm">
            {{ $t('search.listEmpty') }}
        </p>

        <MasonryWall
            v-else
            :items="setups"
            :key-mapper="(item) => item.id"
            :column-width="240"
            :gap="6"
            :min-columns="2"
            :max-columns="3"
            :ssr-columns="isMobile ? 2 : 3"
        >
            <template #default="{ item, index }">
                <div :key="item.id" v-entrance="item.id">
                    <SetupsLink :setup="item" :index />
                </div>
            </template>
        </MasonryWall>
    </div>
</template>

<style scoped>
.setup-card-enter {
    animation: setup-card-enter 180ms ease-out backwards;
}
.setup-card-waiting {
    opacity: 0;
}
.setup-card-enter:focus-within,
.setup-card-waiting:focus-within {
    animation: none;
    opacity: 1;
}
@keyframes setup-card-enter {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
@media (prefers-reduced-motion: reduce) {
    .setup-card-enter,
    .setup-card-waiting {
        animation: none;
        opacity: 1;
    }
}
</style>
