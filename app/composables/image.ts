export const useGetImage = (
    name?: string | null,
    options?: { prefix: string }
): string => {
    if (!name?.length) return '';

    const img = name.split('/').map(encodeURIComponent).join('/');
    const config = useRuntimeConfig();
    const prefix = options?.prefix ? `/${options.prefix}` : '';

    return `${config.public.r2.domain}${prefix}/${img}`;
};

export const useDeleteImage = (name: string, options?: { target?: string }) => {
    return $fetch('/api/image', {
        method: 'DELETE',
        query: { name, target: options?.target },
    });
};
