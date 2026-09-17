ALTER TABLE `skills` ADD COLUMN `files_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
UPDATE `skills`
SET `files_json` = COALESCE(
  (
    SELECT `files_json`
    FROM `skill_versions`
    WHERE `skill_versions`.`skill_id` = `skills`.`id`
    ORDER BY `major` DESC, `minor` DESC, `created_at` DESC
    LIMIT 1
  ),
  '[]'
);
--> statement-breakpoint
DROP TABLE `skill_versions`;