export const useChangelogs = () => {
    const { data, error, refresh, status } = useFetch('/api/changelogs', {
        dedupe: 'defer',
        transform: (response) =>
            response.data.map((item) => ({
                title: item.title,
                description: '',
                date: item.createdAt,
                content: item.markdown,
            })),
        default: () => [],
    })

    return {
        changelogs: data,
        error,
        refresh,
        status,
    }
}
