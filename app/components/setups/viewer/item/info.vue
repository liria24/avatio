<script lang="ts" setup>
interface Props {
    url: string;
    shop: Shop;
    price: string | null;
    likes: number | null;
}
const { url, shop, price, likes } = defineProps<Props>();
</script>

<template>
    <div class="pl-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <NuxtLink
            :to="url"
            target="_blank"
            :class="[
                'mt-px pl-1.5 pr-[0.42rem] py-1 rounded-md flex items-center gap-1',
                'ring-1 ring-pink-500/60',
            ]"
        >
            <Icon
                name="lucide:heart"
                :size="15"
                class="text-zinc-700 dark:text-zinc-100"
            />
            <p
                class="pb-px text-xs leading-0 whitespace-nowrap text-zinc-700 dark:text-zinc-100"
            >
                {{ likes || '?' }}
            </p>
        </NuxtLink>

        <NuxtLink
            :to="url"
            target="_blank"
            class="text-sm font-semibold leading-0 whitespace-nowrap text-zinc-700 dark:text-zinc-300"
        >
            {{ price ? price : '価格不明' }}
        </NuxtLink>

        <HovercardShop :shop="shop">
            <NuxtLink
                :to="`https://${shop.id}.booth.pm/`"
                target="_blank"
                class="flex items-center gap-1.5 w-fit"
            >
                <NuxtImg
                    :src="shop.thumbnail ?? ''"
                    :alt="shop.name"
                    :width="20"
                    :height="20"
                    format="webp"
                    fit="cover"
                    class="size-5 rounded-md border border-zinc-300"
                />
                <span
                    class="font-semibold text-xs line-clamp-1 break-all leading-none whitespace-nowrap text-zinc-700 dark:text-zinc-300"
                >
                    {{ shop.name }}
                </span>
                <Icon
                    v-if="shop.verified"
                    name="lucide:check"
                    :size="16"
                    class="shrink-0 size-3 text-zinc-700 dark:text-zinc-300"
                />
            </NuxtLink>
        </HovercardShop>
    </div>
</template>
