<script lang="ts" setup>
const { getSession } = useAuth()
const session = await getSession()
const colorMode = useColorMode()

const themeMenu = [
    {
        label: 'システム',
        icon: 'mingcute:monitor-fill',
        onSelect: () => {
            colorMode.preference = 'system'
        },
    },
    {
        label: 'ライト',
        icon: 'mingcute:sun-fill',
        onSelect: () => {
            colorMode.preference = 'light'
        },
    },
    {
        label: 'ダーク',
        icon: 'mingcute:moon-fill',
        onSelect: () => {
            colorMode.preference = 'dark'
        },
    },
]
</script>

<template>
    <Html>
        <Head>
            <Title>Avatio</Title>
            <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            <Meta name="lang" content="ja" />
        </Head>
        <Body>
            <UContainer class="flex min-h-dvh flex-col items-center gap-6 pt-6 md:gap-8">
                <header class="flex w-full items-center justify-between gap-6">
                    <div class="flex items-center gap-3">
                        <NuxtLinkLocale to="/">
                            <LogoAvatio class="w-24 sm:w-28" aria-label="Avatio" />
                        </NuxtLinkLocale>

                        <UButton
                            v-if="session?.user.role === 'admin'"
                            :to="$localePath('/admin')"
                            label="admin"
                            variant="subtle"
                            size="xs"
                            class="font-[Geist]"
                        />
                    </div>

                    <ClientOnly v-if="!session">
                        <UDropdownMenu
                            :items="themeMenu"
                            :content="{
                                align: 'center',
                                side: 'bottom',
                                sideOffset: 8,
                            }"
                        >
                            <UTooltip text="テーマ" :delay-duration="50">
                                <UButton
                                    :icon="
                                        colorMode.value === 'dark'
                                            ? 'mingcute:moon-fill'
                                            : 'mingcute:sun-fill'
                                    "
                                    aria-label="テーマ"
                                    variant="ghost"
                                />
                            </UTooltip>
                        </UDropdownMenu>

                        <template #fallback>
                            <UButton
                                icon="mingcute:palette-fill"
                                aria-label="テーマ"
                                variant="ghost"
                            />
                        </template>
                    </ClientOnly>
                </header>

                <main class="grid w-full grow">
                    <slot />
                </main>
            </UContainer>
        </Body>
    </Html>
</template>
