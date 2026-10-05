CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."newsletter_status" AS ENUM('pending', 'confirmed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"user_id" text,
	"dedupe_key" text,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"status" "newsletter_status" DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"consent_text_version" text NOT NULL,
	"confirm_token_hash" text,
	"confirm_token_expires_at" timestamp with time zone,
	"unsubscribe_token_hash" text NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscribe_ip_truncated" text,
	"confirmed_at" timestamp with time zone,
	"confirm_ip_truncated" text,
	"unsubscribed_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"sync_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_dedupe_idx" ON "email_log" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_log_user_idx" ON "email_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_email_idx" ON "newsletter_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "newsletter_status_idx" ON "newsletter_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "newsletter_confirm_token_idx" ON "newsletter_subscriptions" USING btree ("confirm_token_hash");--> statement-breakpoint
CREATE INDEX "newsletter_unsubscribe_token_idx" ON "newsletter_subscriptions" USING btree ("unsubscribe_token_hash");