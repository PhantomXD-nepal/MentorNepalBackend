CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `availability_slots` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`mentor_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_slot` ON `availability_slots` (`mentor_id`,`day_of_week`,`start_time`);--> statement-breakpoint
CREATE TABLE `mentee_profiles` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`bio` text,
	`avatar_url` text,
	`goals` text,
	`career_stage` text,
	`interests` text,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentee_profiles_user_id_unique` ON `mentee_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `mentor_profiles` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`headline` text NOT NULL,
	`bio` text NOT NULL,
	`avatar_url` text,
	`linkedin_url` text,
	`location` text DEFAULT 'Kathmandu, Nepal',
	`languages` text DEFAULT '["Nepali","English"]',
	`expertise_tags` text NOT NULL,
	`years_exp` integer NOT NULL,
	`session_price` integer DEFAULT 0,
	`is_verified` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`total_sessions` integer DEFAULT 0,
	`avg_rating` real DEFAULT 0,
	`review_count` integer DEFAULT 0,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentor_profiles_user_id_unique` ON `mentor_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`is_read` integer DEFAULT false,
	`created_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`session_id` text NOT NULL,
	`mentor_id` text NOT NULL,
	`mentee_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`is_public` integer DEFAULT true,
	`created_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_session_id_unique` ON `reviews` (`session_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`mentor_id` text NOT NULL,
	`mentee_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`duration_mins` integer DEFAULT 30,
	`status` text DEFAULT 'pending',
	`meeting_url` text,
	`daily_room_name` text,
	`topic` text,
	`mentee_note` text,
	`mentor_note` text,
	`cancelled_by` text,
	`cancel_reason` text,
	`reminder_sent` integer DEFAULT false,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now')
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text DEFAULT 'mentee' NOT NULL,
	`onboarding_complete` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `verification_requests` (
	`id` text PRIMARY KEY DEFAULT lower(hex(randomblob(16))) NOT NULL,
	`mentor_id` text NOT NULL,
	`linkedin_url` text NOT NULL,
	`documents` text,
	`status` text DEFAULT 'pending',
	`admin_note` text,
	`reviewed_by` text,
	`created_at` text DEFAULT datetime('now'),
	`updated_at` text DEFAULT datetime('now')
);
