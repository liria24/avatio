<script lang="ts" setup>
definePageMeta({
    middleware: defineNuxtRouteMiddleware(() => {
        const localePath = useLocalePath()
        return navigateTo(localePath('/'))
    }),
})
</script>
