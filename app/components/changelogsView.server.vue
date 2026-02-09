<script setup lang="ts">
interface Props {
    versions: {
        title: string
        description: string
        date: string
        content?: string
    }[]
}
const { versions } = defineProps<Props>()
</script>

<template>
    <UChangelogVersions>
        <UChangelogVersion
            v-for="(version, index) in versions"
            :key="index"
            v-bind="version"
            :ui="{ container: 'ml-40 mr-0 max-w-full', title: 'text-3xl sentence' }"
        >
            <template #description>
                <MDC
                    v-if="version.content"
                    :value="version.content"
                    class="sentence w-full max-w-full"
                />
            </template>
        </UChangelogVersion>
    </UChangelogVersions>
</template>
