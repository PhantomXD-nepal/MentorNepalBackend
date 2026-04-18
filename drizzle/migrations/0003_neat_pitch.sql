ALTER TABLE `mentor_profiles` ADD `documents` text DEFAULT '[]';
--> statement-breakpoint
UPDATE `mentor_profiles` SET `documents` = '[]' WHERE `documents` IS NULL;
