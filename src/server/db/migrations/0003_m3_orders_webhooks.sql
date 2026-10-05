CREATE TYPE "public"."currency" AS ENUM('EUR', 'CHF');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('paid', 'refunded', 'chargeback', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
ALTER TYPE "public"."entitlement_event_type" ADD VALUE 'reduced';--> statement-breakpoint
CREATE TABLE "admin_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"transaction_id" text NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"product_id" uuid,
	"user_id" text,
	"status" "order_status" DEFAULT 'paid' NOT NULL,
	"amount_minor" integer,
	"currency" "currency",
	"buyer_country" text,
	"customer_type" "customer_type" DEFAULT 'b2c' NOT NULL,
	"company_name" text,
	"vat_id" text,
	"billing_street" text,
	"billing_postal_code" text,
	"billing_city" text,
	"billing_country" text,
	"receipt_reference" text,
	"payment_method" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	"retention_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_provider_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"provider_event_type" text NOT NULL,
	"transaction_id" text,
	"raw_body" text NOT NULL,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_provider_mappings" ADD CONSTRAINT "product_provider_mappings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_notifications_created_idx" ON "admin_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_tx_idx" ON "orders" USING btree ("provider","transaction_id");--> statement-breakpoint
CREATE INDEX "orders_provider_order_idx" ON "orders" USING btree ("provider","provider_order_id","provider_product_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_purchased_idx" ON "orders" USING btree ("purchased_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_provider_mappings_idx" ON "product_provider_mappings" USING btree ("provider","provider_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_event_key_idx" ON "webhook_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status","received_at");--> statement-breakpoint
ALTER TABLE "entitlement_events" ADD CONSTRAINT "entitlement_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;