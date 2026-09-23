<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const { src } = defineProps<{ src?: string }>()
const image = useTemplateRef('image')
const state = ref<'loading' | 'revealing' | 'ready' | 'error'>(src ? 'loading' : 'error')
const motion = usePreferredReducedMotion()
const events = computed(() => {
    const source = src
    return {
        load: (event: Event) => {
            if (source === src) loaded(event)
        },
        error: (event: Event | string) => {
            if (source === src) failed(event)
        },
    }
})
let mounted = false
const { start, stop } = useTimeoutFn(
    () => {
        state.value = 'ready'
    },
    180,
    { immediate: false },
)
function finish() {
    stop()
    state.value = 'ready'
}
function loaded(event: Event) {
    const element = image.value?.imgEl
    if (!mounted || !element || (event.target && event.target !== element)) return
    if (!element.complete || !element.naturalWidth) return
    if (state.value !== 'loading') return
    if (motion.value === 'reduce') return finish()
    state.value = 'revealing'
    start()
}
function failed(event: Event | string) {
    if (typeof event !== 'string' && event.target && event.target !== image.value?.imgEl) return
    stop()
    state.value = 'error'
}
function inspect() {
    const element = image.value?.imgEl
    if (!src || (element?.complete && !element.naturalWidth)) state.value = 'error'
    else if (element?.complete && element.naturalWidth > 0) finish()
}
onMounted(() => {
    mounted = true
    inspect()
})
watch(
    () => src,
    async () => {
        stop()
        state.value = src ? 'loading' : 'error'
        await nextTick()
        inspect()
    },
)
watch(motion, (value) => {
    if (value === 'reduce' && state.value === 'revealing') finish()
})
</script>

<template>
    <span
        class="setup-image relative block overflow-hidden rounded-lg"
        :class="$attrs.class"
        :data-state="state"
    >
        <USkeleton
            as="span"
            v-if="state === 'loading' || state === 'revealing'"
            aria-hidden="true"
            class="setup-skeleton pointer-events-none absolute inset-0 animate-none rounded-[inherit]"
        />
        <NuxtImg
            :key="src"
            ref="image"
            v-bind="$attrs"
            :src="src"
            class="setup-image-content relative"
            @load="events.load"
            @error="events.error"
        />
        <span
            v-if="state === 'error'"
            aria-hidden="true"
            class="bg-muted text-muted pointer-events-none absolute inset-0 flex items-center justify-center"
        >
            <Icon name="mingcute:pic-line" size="24" />
        </span>
    </span>
</template>

<style scoped>
.setup-image-content {
    opacity: 1;
}
[data-state='revealing'] > .setup-image-content {
    animation: setup-image-reveal 180ms ease-out;
}
[data-state='revealing'] > .setup-skeleton {
    animation: setup-skeleton-hide 180ms ease-out forwards;
}
@keyframes setup-image-reveal {
    from {
        opacity: 0;
        filter: blur(4px);
    }
    to {
        opacity: 1;
        filter: blur(0);
    }
}
@keyframes setup-skeleton-hide {
    to {
        opacity: 0;
    }
}
@media (prefers-reduced-motion: reduce) {
    [data-state='revealing'] > .setup-image-content,
    [data-state='revealing'] > .setup-skeleton {
        animation: none;
    }
}
</style>
