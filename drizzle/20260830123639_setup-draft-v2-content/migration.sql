UPDATE `setup_drafts`
SET `content` = json_object(
    'public', json(CASE WHEN COALESCE(json_extract(`content`, '$.public'), 1) THEN 'true' ELSE 'false' END),
    'name', COALESCE(json_extract(`content`, '$.name'), ''),
    'description', COALESCE(json_extract(`content`, '$.description'), ''),
    'images', json(COALESCE(json_extract(`content`, '$.images'), '[]')),
    'imageMetadata', json(COALESCE(json_extract(`content`, '$.imageMetadata'), '{}')),
    'tags', json(COALESCE((
        SELECT json_group_array(json_extract(`tag`.`value`, '$.tag'))
        FROM json_each(`setup_drafts`.`content`, '$.tags') AS `tag`
    ), '[]')),
    'coauthors', json(COALESCE((
        SELECT json_group_array(json_object(
            'userId', CAST(json_extract(`coauthor`.`value`, '$.userId') AS TEXT),
            'username', json_extract(`coauthor`.`value`, '$.username'),
            'note', COALESCE(json_extract(`coauthor`.`value`, '$.note'), '')
        ))
        FROM json_each(`setup_drafts`.`content`, '$.coauthors') AS `coauthor`
    ), '[]')),
    'items', json(COALESCE((
        SELECT json_group_array(json_object(
            'itemId', CAST(json_extract(`item`.`value`, '$.itemId') AS TEXT),
            'category', COALESCE(json_extract(`item`.`value`, '$.category'), 'other'),
            'note', COALESCE(json_extract(`item`.`value`, '$.note'), ''),
            'unsupported', json(CASE WHEN COALESCE(json_extract(`item`.`value`, '$.unsupported'), 0) THEN 'true' ELSE 'false' END),
            'shapekeys', json(COALESCE(json_extract(`item`.`value`, '$.shapekeys'), '[]'))
        ))
        FROM json_each(`setup_drafts`.`content`, '$.items') AS `item`
    ), '[]'))
);
