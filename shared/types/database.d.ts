export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    graphql_public: {
        Tables: {
            [_ in never]: never;
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            graphql: {
                Args: {
                    operationName?: string;
                    query?: string;
                    variables?: Json;
                    extensions?: Json;
                };
                Returns: Json;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
    public: {
        Tables: {
            admin: {
                Row: {
                    created_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'admin_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: true;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            bookmarks: {
                Row: {
                    created_at: string;
                    id: number;
                    post: number;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: number;
                    post: number;
                    user_id?: string;
                };
                Update: {
                    created_at?: string;
                    id?: number;
                    post?: number;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'bookmarks_post_fkey';
                        columns: ['post'];
                        isOneToOne: false;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'bookmarks_user_id_fkey1';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            feedback: {
                Row: {
                    contents: string;
                    created_at: string;
                    dealt: boolean;
                    id: number;
                    user: string;
                };
                Insert: {
                    contents: string;
                    created_at?: string;
                    dealt?: boolean;
                    id?: number;
                    user?: string;
                };
                Update: {
                    contents?: string;
                    created_at?: string;
                    dealt?: boolean;
                    id?: number;
                    user?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'feedback_user_fkey';
                        columns: ['user'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            info: {
                Row: {
                    category: string | null;
                    content: string;
                    created_at: string;
                    published: boolean;
                    slug: string;
                    thumbnail: string | null;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    category?: string | null;
                    content: string;
                    created_at?: string;
                    published?: boolean;
                    slug: string;
                    thumbnail?: string | null;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    category?: string | null;
                    content?: string;
                    created_at?: string;
                    published?: boolean;
                    slug?: string;
                    thumbnail?: string | null;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            items: {
                Row: {
                    category: Database['public']['Enums']['item_category'];
                    created_at: string;
                    id: number;
                    likes: number | null;
                    name: string;
                    nsfw: boolean;
                    outdated: boolean;
                    price: string | null;
                    shop_id: string;
                    source: string | null;
                    thumbnail: string;
                    updated_at: string;
                };
                Insert: {
                    category?: Database['public']['Enums']['item_category'];
                    created_at?: string;
                    id: number;
                    likes?: number | null;
                    name: string;
                    nsfw: boolean;
                    outdated?: boolean;
                    price?: string | null;
                    shop_id: string;
                    source?: string | null;
                    thumbnail: string;
                    updated_at?: string;
                };
                Update: {
                    category?: Database['public']['Enums']['item_category'];
                    created_at?: string;
                    id?: number;
                    likes?: number | null;
                    name?: string;
                    nsfw?: boolean;
                    outdated?: boolean;
                    price?: string | null;
                    shop_id?: string;
                    source?: string | null;
                    thumbnail?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'items_shop_id_fkey';
                        columns: ['shop_id'];
                        isOneToOne: false;
                        referencedRelation: 'shops';
                        referencedColumns: ['id'];
                    },
                ];
            };
            releases: {
                Row: {
                    category: Database['public']['Enums']['release_category'];
                    content: string;
                    created_at: string;
                    description: string;
                    emoji: string | null;
                    published: boolean;
                    short_title: string;
                    slug: string;
                    thumbnail: string | null;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    category?: Database['public']['Enums']['release_category'];
                    content?: string;
                    created_at?: string;
                    description?: string;
                    emoji?: string | null;
                    published?: boolean;
                    short_title?: string;
                    slug: string;
                    thumbnail?: string | null;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    category?: Database['public']['Enums']['release_category'];
                    content?: string;
                    created_at?: string;
                    description?: string;
                    emoji?: string | null;
                    published?: boolean;
                    short_title?: string;
                    slug?: string;
                    thumbnail?: string | null;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            report_setup: {
                Row: {
                    additional: string | null;
                    created_at: string;
                    dealt: boolean;
                    hate: boolean;
                    id: number;
                    infringement: boolean;
                    nsfw_image: boolean;
                    other: boolean;
                    reporter: string;
                    setup_id: number;
                    spam: boolean;
                };
                Insert: {
                    additional?: string | null;
                    created_at?: string;
                    dealt?: boolean;
                    hate?: boolean;
                    id?: number;
                    infringement?: boolean;
                    nsfw_image?: boolean;
                    other?: boolean;
                    reporter?: string;
                    setup_id: number;
                    spam?: boolean;
                };
                Update: {
                    additional?: string | null;
                    created_at?: string;
                    dealt?: boolean;
                    hate?: boolean;
                    id?: number;
                    infringement?: boolean;
                    nsfw_image?: boolean;
                    other?: boolean;
                    reporter?: string;
                    setup_id?: number;
                    spam?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: 'report_setup_reporter_fkey';
                        columns: ['reporter'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'report_setup_setup_id_fkey';
                        columns: ['setup_id'];
                        isOneToOne: false;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                ];
            };
            report_user: {
                Row: {
                    additional: string | null;
                    created_at: string;
                    dealt: boolean;
                    hate: boolean;
                    id: number;
                    infringement: boolean;
                    other: boolean;
                    reportee: string;
                    reporter: string;
                    spam: boolean;
                };
                Insert: {
                    additional?: string | null;
                    created_at?: string;
                    dealt?: boolean;
                    hate?: boolean;
                    id?: number;
                    infringement?: boolean;
                    other?: boolean;
                    reportee: string;
                    reporter?: string;
                    spam?: boolean;
                };
                Update: {
                    additional?: string | null;
                    created_at?: string;
                    dealt?: boolean;
                    hate?: boolean;
                    id?: number;
                    infringement?: boolean;
                    other?: boolean;
                    reportee?: string;
                    reporter?: string;
                    spam?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: 'report_user_reportee_fkey';
                        columns: ['reportee'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'report_user_reportee_fkey1';
                        columns: ['reportee'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'report_user_reporter_fkey';
                        columns: ['reporter'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setup_coauthors: {
                Row: {
                    id: number;
                    note: string;
                    setup_id: number;
                    user_id: string;
                };
                Insert: {
                    id?: number;
                    note?: string;
                    setup_id: number;
                    user_id: string;
                };
                Update: {
                    id?: number;
                    note?: string;
                    setup_id?: number;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setup_coauthor_setup_id_fkey';
                        columns: ['setup_id'];
                        isOneToOne: false;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'setup_coauthor_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setup_images: {
                Row: {
                    created_at: string;
                    height: number | null;
                    name: string;
                    setup_id: number | null;
                    width: number | null;
                };
                Insert: {
                    created_at?: string;
                    height?: number | null;
                    name: string;
                    setup_id?: number | null;
                    width?: number | null;
                };
                Update: {
                    created_at?: string;
                    height?: number | null;
                    name?: string;
                    setup_id?: number | null;
                    width?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setup_images_setup_id_fkey';
                        columns: ['setup_id'];
                        isOneToOne: false;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setup_item_shapekeys: {
                Row: {
                    id: number;
                    name: string;
                    setup_item_id: number;
                    value: number;
                };
                Insert: {
                    id?: number;
                    name: string;
                    setup_item_id: number;
                    value: number;
                };
                Update: {
                    id?: number;
                    name?: string;
                    setup_item_id?: number;
                    value?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setup_item_shapekeys_setup_item_id_fkey';
                        columns: ['setup_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'setup_items';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setup_items: {
                Row: {
                    category:
                        | Database['public']['Enums']['item_category']
                        | null;
                    id: number;
                    item_id: number;
                    note: string;
                    setup_id: number;
                    unsupported: boolean;
                };
                Insert: {
                    category?:
                        | Database['public']['Enums']['item_category']
                        | null;
                    id?: number;
                    item_id: number;
                    note?: string;
                    setup_id: number;
                    unsupported?: boolean;
                };
                Update: {
                    category?:
                        | Database['public']['Enums']['item_category']
                        | null;
                    id?: number;
                    item_id?: number;
                    note?: string;
                    setup_id?: number;
                    unsupported?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setup_items_item_id_fkey';
                        columns: ['item_id'];
                        isOneToOne: false;
                        referencedRelation: 'items';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'setup_items_setup_id_fkey';
                        columns: ['setup_id'];
                        isOneToOne: false;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setup_og_image: {
                Row: {
                    image: string;
                    position_x: number;
                    position_y: number;
                    setup_id: number;
                    width: number;
                };
                Insert: {
                    image: string;
                    position_x?: number;
                    position_y?: number;
                    setup_id: number;
                    width?: number;
                };
                Update: {
                    image?: string;
                    position_x?: number;
                    position_y?: number;
                    setup_id?: number;
                    width?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setup_og_image_image_fkey';
                        columns: ['image'];
                        isOneToOne: false;
                        referencedRelation: 'setup_images';
                        referencedColumns: ['name'];
                    },
                    {
                        foreignKeyName: 'setup_og_image_setup_id_fkey';
                        columns: ['setup_id'];
                        isOneToOne: true;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setup_tags: {
                Row: {
                    id: number;
                    setup_id: number;
                    tag: string;
                };
                Insert: {
                    id?: number;
                    setup_id: number;
                    tag: string;
                };
                Update: {
                    id?: number;
                    setup_id?: number;
                    tag?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setup_tags_setup_id_fkey';
                        columns: ['setup_id'];
                        isOneToOne: false;
                        referencedRelation: 'setups';
                        referencedColumns: ['id'];
                    },
                ];
            };
            setups: {
                Row: {
                    author: string;
                    created_at: string;
                    description: string;
                    id: number;
                    name: string;
                    unity: string | null;
                    updated_at: string;
                };
                Insert: {
                    author?: string;
                    created_at?: string;
                    description?: string;
                    id?: number;
                    name: string;
                    unity?: string | null;
                    updated_at?: string;
                };
                Update: {
                    author?: string;
                    created_at?: string;
                    description?: string;
                    id?: number;
                    name?: string;
                    unity?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'setups_author_fkey';
                        columns: ['author'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            shop_verification: {
                Row: {
                    code: string;
                    created_at: string;
                    user_id: string;
                };
                Insert: {
                    code: string;
                    created_at?: string;
                    user_id: string;
                };
                Update: {
                    code?: string;
                    created_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'shop_verification_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            shops: {
                Row: {
                    created_at: string;
                    id: string;
                    name: string;
                    thumbnail: string | null;
                    updated_at: string;
                    verified: boolean;
                };
                Insert: {
                    created_at?: string;
                    id: string;
                    name: string;
                    thumbnail?: string | null;
                    updated_at?: string;
                    verified: boolean;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    name?: string;
                    thumbnail?: string | null;
                    updated_at?: string;
                    verified?: boolean;
                };
                Relationships: [];
            };
            user_badges: {
                Row: {
                    created_at: string;
                    id: number;
                    name: Database['public']['Enums']['user_badge'];
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: number;
                    name: Database['public']['Enums']['user_badge'];
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: number;
                    name?: Database['public']['Enums']['user_badge'];
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_badges_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_shops: {
                Row: {
                    created_at: string;
                    id: number;
                    shop_id: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: number;
                    shop_id: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: number;
                    shop_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'user_shops_shop_id_fkey';
                        columns: ['shop_id'];
                        isOneToOne: false;
                        referencedRelation: 'shops';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'user_shops_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            users: {
                Row: {
                    avatar: string | null;
                    bio: string | null;
                    created_at: string;
                    id: string;
                    links: string[];
                    name: string;
                    official: boolean;
                };
                Insert: {
                    avatar?: string | null;
                    bio?: string | null;
                    created_at?: string;
                    id: string;
                    links?: string[];
                    name?: string;
                    official?: boolean;
                };
                Update: {
                    avatar?: string | null;
                    bio?: string | null;
                    created_at?: string;
                    id?: string;
                    links?: string[];
                    name?: string;
                    official?: boolean;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            popular_avatars: {
                Args: Record<PropertyKey, never>;
                Returns: {
                    category: Database['public']['Enums']['item_category'];
                    created_at: string;
                    id: number;
                    likes: number | null;
                    name: string;
                    nsfw: boolean;
                    outdated: boolean;
                    price: string | null;
                    shop_id: string;
                    source: string | null;
                    thumbnail: string;
                    updated_at: string;
                }[];
            };
            search_items: {
                Args: {
                    keyword: string;
                    exclude_categories: string[];
                    num: number;
                };
                Returns: Json;
            };
            search_setups: {
                Args: {
                    word: string;
                    items: number[];
                    tags: string[];
                    page: number;
                    per_page: number;
                };
                Returns: Json;
            };
            search_tags: {
                Args: { keywords: string; exclude: string[] };
                Returns: {
                    tag: string;
                    score: number;
                }[];
            };
            search_users: {
                Args: { keyword: string; num: number };
                Returns: Json;
            };
            update_item_updated_at: {
                Args: { item_id: number };
                Returns: undefined;
            };
        };
        Enums: {
            item_category:
                | 'avatar'
                | 'cloth'
                | 'accessory'
                | 'hair'
                | 'shader'
                | 'texture'
                | 'tool'
                | 'other';
            release_category: 'news' | 'update' | 'event' | 'blog';
            user_badge:
                | 'developer'
                | 'contributor'
                | 'translator'
                | 'alpha_tester'
                | 'shop_owner'
                | 'patrol'
                | 'idea_man';
        };
        CompositeTypes: {
            setup_with_details: {
                setup_id: number | null;
                created_at: string | null;
                name: string | null;
                description: string | null;
                updated_at: string | null;
                image: string | null;
                avatar_note: string | null;
                avatar: number | null;
                author: string | null;
                user_id: string | null;
                user_name: string | null;
                item_id: number | null;
                item_name: string | null;
                tag: string | null;
            };
        };
    };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            item_category: [
                'avatar',
                'cloth',
                'accessory',
                'hair',
                'shader',
                'texture',
                'tool',
                'other',
            ],
            release_category: ['news', 'update', 'event', 'blog'],
            user_badge: [
                'developer',
                'contributor',
                'translator',
                'alpha_tester',
                'shop_owner',
                'patrol',
                'idea_man',
            ],
        },
    },
} as const;
