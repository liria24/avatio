// booth.pm/{lang}/items/{id}.json
// 実際に利用する可能性のあるキーのみ
export interface Booth {
    url: string;
    id: number;
    is_adult: boolean;
    is_buyee_possible: boolean;
    is_end_of_sale: boolean;
    is_placeholder: boolean;
    is_sold_out: boolean;
    name: string;
    description: string | null;
    published_at: string;
    price: string;
    wish_lists_count: number;
    category: {
        id: number;
        name: string;
        parent: {
            name: string;
            url: string;
        };
        url: string;
    };
    images: {
        caption: string | null;
        original: string;
        resized: string;
    }[];
    shop: {
        name: string;
        subdomain: string;
        thumbnail_url: string;
        url: string;
        verified: boolean;
    };
    tags: {
        name: string;
        url: string;
    }[];
    variations: {
        status: string;
    }[];
}
