<script lang="ts" setup>
import { Analytics } from '@vercel/analytics/nuxt';

const route = useRoute();
const paddingExclude = ['/', '/release', '/setup/compose'];
const footerExclude = ['/setup/compose'];

const env = ref<string | undefined>(undefined);
try {
    env.value = process?.env?.NODE_ENV;
} catch {
    env.value = undefined;
}

useHead({
    bodyAttrs: {
        class: 'bg-zinc-50 dark:bg-zinc-900 text-black dark:text-white font-[Murecho] transition duration-50 delay-0 ease-in-out',
    },
    title: 'Avatio',
    link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    meta: [{ name: 'lang', content: 'ja' }],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleError = (error: any) => {
    console.error('Layout error:', error);
};
</script>

<template>
    <NuxtErrorBoundary @error="handleError">
        <Analytics />
        <div
            class="max-w-7xl min-h-screen mx-auto pt-6 px-6 lg:px-8 flex flex-col gap-6 md:gap-12 items-center"
        >
            <UiIsMaintenance
                v-if="env === 'development'"
                class="empty:hidden fixed bottom-0 right-0 m-2 opacity-40"
            />
            <UiHeader />
            <div
                :class="[
                    'w-full grow grid',
                    paddingExclude.includes(route.path)
                        ? 'px-4'
                        : 'md:px-20 lg:px-32',
                ]"
            >
                <slot />
            </div>
            <UiFooter v-if="!footerExclude.includes(route.path)" />
        </div>
    </NuxtErrorBoundary>
</template>
