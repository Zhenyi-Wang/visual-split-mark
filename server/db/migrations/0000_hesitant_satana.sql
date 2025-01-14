CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`audio_file_id` text NOT NULL,
	`start` real NOT NULL,
	`end` real NOT NULL,
	`text` text NOT NULL,
	`whisper_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`audio_file_id`) REFERENCES `audio_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audio_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`original_name` text NOT NULL,
	`original_path` text NOT NULL,
	`wav_path` text,
	`duration` real DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`whisper_api_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
