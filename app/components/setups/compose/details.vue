<script setup lang="ts">
const { form, editingSetupId } = useSetupCompose()
</script>

<template>
    <div class="contents">
        <SetupsComposeEditingSetup v-if="editingSetupId" :setup-id="editingSetupId" />

        <form.Field v-slot="{ field }" name="name">
            <UFormField name="name" :label="$t('setup.compose.nameLabel')" required>
                <UInput
                    :model-value="field.value"
                    :placeholder="$t('setup.compose.namePlaceholder')"
                    autocomplete="off"
                    variant="none"
                    size="xl"
                    class="border-muted w-full border-b"
                    @blur="field.handleBlur"
                    @keydown.enter.prevent
                    @update:model-value="field.handleChange"
                />
            </UFormField>
        </form.Field>

        <SetupsComposeImages />

        <form.Field v-slot="{ field }" name="description">
            <UFormField name="description" :label="$t('setup.compose.descriptionLabel')">
                <UTextarea
                    :model-value="field.value"
                    :placeholder="$t('setup.compose.descriptionPlaceholder')"
                    autoresize
                    :rows="5"
                    variant="soft"
                    class="w-full"
                    @blur="field.handleBlur"
                    @update:model-value="field.handleChange"
                />
            </UFormField>
        </form.Field>

        <SetupsComposeTags />
        <SetupsComposeCoauthors />

        <form.Field v-slot="{ field }" name="public">
            <USwitch
                :model-value="!field.value"
                :label="$t('setup.compose.limitedPublic')"
                :description="$t('setup.compose.limitedPublicDescription')"
                color="neutral"
                :ui="{ description: 'text-xs mt-1' }"
                class="mt-auto"
                @update:model-value="(value) => field.handleChange(!value)"
            />
        </form.Field>
    </div>
</template>
