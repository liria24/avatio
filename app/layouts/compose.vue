<template>
    <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
        <slot />
    </MotionConfig>
</template>
