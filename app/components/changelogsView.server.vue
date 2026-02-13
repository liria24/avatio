<script setup lang="ts">
const { changelogs } = useChangelogs()
console.log(changelogs.value)

const formattedChangelogs = computed(() =>
    changelogs.value.map((changelog) => ({
        title: changelog.title,
        description: '',
        date: changelog.createdAt,
        content: changelog.markdown,
    })),
)
</script>

<template>
    <UChangelogVersions>
        <UChangelogVersion
            v-for="(changelog, index) in formattedChangelogs"
            :key="index"
            v-bind="changelog"
            :ui="{ container: 'ml-40 mr-0 max-w-full', title: 'text-3xl sentence' }"
        >
            <template #description>
                <MDC
                    v-if="changelog.content"
                    :value="changelog.content"
                    class="sentence w-full max-w-full"
                />
            </template>
        </UChangelogVersion>
    </UChangelogVersions>
</template>
