-- Preserve report identities while the previous Worker is still serving requests.
UPDATE item_reports
SET catalog_item_id = (
    SELECT source.item_id FROM items legacy
    JOIN item_sources source ON source.provider_key = legacy.platform AND source.external_id = legacy.id
    WHERE legacy.id = item_reports.item_id
)
WHERE catalog_item_id IS NULL;
--> statement-breakpoint
CREATE TABLE _catalog_report_contract_check (missing integer NOT NULL CHECK (missing = 0));
--> statement-breakpoint
INSERT INTO _catalog_report_contract_check SELECT count(*) FROM item_reports WHERE catalog_item_id IS NULL;
--> statement-breakpoint
DROP TABLE _catalog_report_contract_check;
--> statement-breakpoint
-- Removed by the following contract migration after the new Worker is verified.
CREATE TRIGGER catalog_report_transition AFTER INSERT ON item_reports
WHEN NEW.catalog_item_id IS NULL AND NEW.item_id IS NOT NULL
BEGIN
    UPDATE item_reports SET catalog_item_id = (
        SELECT source.item_id FROM items legacy
        JOIN item_sources source ON source.provider_key = legacy.platform AND source.external_id = legacy.id
        WHERE legacy.id = NEW.item_id
    ) WHERE id = NEW.id;
    SELECT RAISE(ABORT, 'Missing CatalogItem for report')
    WHERE (SELECT catalog_item_id FROM item_reports WHERE id = NEW.id) IS NULL;
END;
