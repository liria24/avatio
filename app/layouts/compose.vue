<template>
    <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
        <div class="flex min-h-dvh flex-col items-center gap-6 p-6 md:gap-8">
            <header class="flex w-full items-center justify-between gap-6">
                <HeaderLeft />
                <div class="flex items-center gap-1">
                    <HeaderThemeButton />
                    <div class="flex items-center gap-2">
                        <LazyNotificationButton />
                        <LazyHeaderMenu />
                    </div>
                </div>
            </header>
            <main class="grid w-full grow"><slot /></main>
        </div>
    </MotionConfig>
</template>
