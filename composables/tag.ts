export const useGetPopularTags = async () => {
    const client = await useSBClient();

    const { data, error } = await client.rpc("tags_order_by_count");

    if (!error) {
        return data.map((obj: { tag: string }) => obj.tag);
    } else {
        console.error(error);
        return null;
    }
};
