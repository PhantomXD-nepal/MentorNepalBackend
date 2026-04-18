CREATE TABLE `availability_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`mentor_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentor_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_slots_mentor_id_day_of_week_start_time_unique` ON `availability_slots` (`mentor_id`,`day_of_week`,`start_time`);--> statement-breakpoint
CREATE TABLE `mentee_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`bio` text,
	`avatar_url` text,
	`goals` text,
	`career_stage` text,
	`interests` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentee_profiles_user_id_unique` ON `mentee_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `mentor_profiles` (
	`id` text PRIMARY KEY NOT NULL,
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
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentor_profiles_user_id_unique` ON `mentor_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`is_read` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`mentor_id` text NOT NULL,
	`mentee_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`is_public` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentor_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mentee_id`) REFERENCES `mentee_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_session_id_unique` ON `reviews` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
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
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`mentor_id`) REFERENCES `mentor_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mentee_id`) REFERENCES `mentee_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verification_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`mentor_id` text NOT NULL,
	`linkedin_url` text NOT NULL,
	`documents` text,
	`status` text DEFAULT 'pending',
	`admin_note` text,
	`reviewed_by` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`mentor_id`) REFERENCES `mentor_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'mentee';--> statement-breakpoint
ALTER TABLE `user` ADD `onboarding_complete` integer DEFAULT false;