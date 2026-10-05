CREATE TYPE "public"."media_kind" AS ENUM('video', 'audio', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "lesson_media" (
	"lesson_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lesson_media_lesson_id_media_id_pk" PRIMARY KEY("lesson_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "media_kind" NOT NULL,
	"title" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"size_bytes" bigint,
	"download_allowed" boolean DEFAULT false NOT NULL,
	"storage_key" text,
	"video_provider" text,
	"provider_video_id" text,
	"duration_seconds" integer,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_captions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_captions" ADD CONSTRAINT "media_captions_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_media_media_idx" ON "lesson_media" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_captions_lang_idx" ON "media_captions" USING btree ("media_id","language");