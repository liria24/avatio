WITH defaults(value_key) AS (
    VALUES
        ('22'), ('123'), ('124'), ('125'), ('126'), ('127'), ('128'), ('129'),
        ('134'), ('208'), ('209'), ('210'), ('211'), ('212'), ('213'), ('214'),
        ('215'), ('216'), ('217'), ('230'), ('231')
), categories(value_key) AS (
    SELECT CAST(category_id AS text) FROM allowed_booth_categories
    UNION
    SELECT value_key FROM defaults
)
INSERT INTO provider_admission_options (
    provider_key,
    facet_key,
    value_key,
    label,
    first_seen_at,
    last_seen_at
)
SELECT
    'booth',
    'category',
    value_key,
    coalesce(
        (
            SELECT provider_category_label
            FROM item_sources
            WHERE provider_key = 'booth'
              AND provider_category_key = categories.value_key
              AND provider_category_label IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1
        ),
        value_key
    ),
    unixepoch() * 1000,
    unixepoch() * 1000
FROM categories;
--> statement-breakpoint
INSERT INTO provider_admission_rules (provider_key, facet_key, value_key, decision)
SELECT provider_key, facet_key, value_key, 'allow'
FROM provider_admission_options
WHERE provider_key = 'booth' AND facet_key = 'category';
--> statement-breakpoint
INSERT INTO provider_admission_options (
    provider_key,
    facet_key,
    value_key,
    label,
    first_seen_at,
    last_seen_at
) VALUES ('booth', 'tag', 'vrchat', 'VRChat', unixepoch() * 1000, unixepoch() * 1000);
--> statement-breakpoint
INSERT INTO provider_admission_rules (provider_key, facet_key, value_key, decision)
VALUES ('booth', 'tag', 'vrchat', 'allow');
