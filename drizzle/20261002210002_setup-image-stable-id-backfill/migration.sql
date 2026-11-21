UPDATE `setup_images` SET `stable_id` = CAST(`id` AS TEXT) WHERE `stable_id` IS NULL;
