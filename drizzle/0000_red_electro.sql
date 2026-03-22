CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"telegramAccountId" integer,
	"action" varchar(100) NOT NULL,
	"details" text,
	"status" varchar(50) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anti_ban_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_account_id" integer,
	"rule_name" varchar(255) NOT NULL,
	"rule_type" varchar(50) NOT NULL,
	"rule_config" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_reply_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_account_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"keywords" text[] NOT NULL,
	"match_type" varchar(20) NOT NULL,
	"reply_type" varchar(20) NOT NULL,
	"reply_content" text NOT NULL,
	"ai_prompt" text,
	"delay_min" integer DEFAULT 2000,
	"delay_max" integer DEFAULT 5000,
	"reactions" text[],
	"target_types" text[] NOT NULL,
	"daily_limit" integer DEFAULT 50,
	"priority" integer DEFAULT 0,
	"options" text,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"operation_type" varchar(50) NOT NULL,
	"source_group_id" varchar(255),
	"target_group_id" varchar(255),
	"message_content" text,
	"delay_between_messages" integer DEFAULT 1000,
	"total_members" integer DEFAULT 0,
	"processed_members" integer DEFAULT 0,
	"successful_members" integer DEFAULT 0,
	"failed_members" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_cloner_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_account_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_channel_ids" text[] NOT NULL,
	"target_channel_ids" text[] NOT NULL,
	"filters" text NOT NULL,
	"modifications" text NOT NULL,
	"schedule" text,
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp,
	"total_cloned" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_account_id" integer NOT NULL,
	"source_group_id" varchar(255) NOT NULL,
	"member_telegram_id" varchar(50) NOT NULL,
	"member_username" varchar(255),
	"member_first_name" varchar(255),
	"member_last_name" varchar(255),
	"member_phone" varchar(20),
	"extraction_date" timestamp DEFAULT now() NOT NULL,
	"is_added" boolean DEFAULT false NOT NULL,
	"added_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "license_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"licenseId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"metadata" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"licenseKey" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"activatedAt" timestamp,
	"expiresAt" timestamp,
	"maxAccounts" integer DEFAULT 1 NOT NULL,
	"maxMessages" integer DEFAULT 1000 NOT NULL,
	"features" text[] DEFAULT '{}' NOT NULL,
	"hardwareId" varchar(255),
	"lastValidated" timestamp,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"maxUsage" integer,
	"autoRenew" boolean DEFAULT false NOT NULL,
	"renewalPrice" numeric(10, 2),
	CONSTRAINT "licenses_licenseKey_unique" UNIQUE("licenseKey")
);
--> statement-breakpoint
CREATE TABLE "proxy_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"telegramAccountId" integer,
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"username" varchar(100),
	"password" varchar(100),
	"type" varchar(20) DEFAULT 'http' NOT NULL,
	"health" varchar(20) DEFAULT 'unknown' NOT NULL,
	"lastCheckedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"members_added" integer DEFAULT 0,
	"operations_completed" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"licenseId" integer NOT NULL,
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"autoRenew" boolean DEFAULT true NOT NULL,
	"nextBillingDate" timestamp,
	"paymentMethod" varchar(100),
	"paymentId" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"telegram_id" varchar(50),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"username" varchar(255),
	"session_string" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"restriction_reason" text,
	"warming_level" integer DEFAULT 0 NOT NULL,
	"messages_sent_today" integer DEFAULT 0 NOT NULL,
	"daily_limit" integer DEFAULT 100 NOT NULL,
	"last_activity_at" timestamp,
	"last_restricted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_accounts_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "telegram_accounts_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_telegramAccountId_telegram_accounts_id_fk" FOREIGN KEY ("telegramAccountId") REFERENCES "public"."telegram_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anti_ban_rules" ADD CONSTRAINT "anti_ban_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anti_ban_rules" ADD CONSTRAINT "anti_ban_rules_telegram_account_id_telegram_accounts_id_fk" FOREIGN KEY ("telegram_account_id") REFERENCES "public"."telegram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_telegram_account_id_telegram_accounts_id_fk" FOREIGN KEY ("telegram_account_id") REFERENCES "public"."telegram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_cloner_rules" ADD CONSTRAINT "content_cloner_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_cloner_rules" ADD CONSTRAINT "content_cloner_rules_telegram_account_id_telegram_accounts_id_fk" FOREIGN KEY ("telegram_account_id") REFERENCES "public"."telegram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_members" ADD CONSTRAINT "extracted_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_members" ADD CONSTRAINT "extracted_members_telegram_account_id_telegram_accounts_id_fk" FOREIGN KEY ("telegram_account_id") REFERENCES "public"."telegram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_usage_logs" ADD CONSTRAINT "license_usage_logs_licenseId_licenses_id_fk" FOREIGN KEY ("licenseId") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_configs" ADD CONSTRAINT "proxy_configs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_configs" ADD CONSTRAINT "proxy_configs_telegramAccountId_telegram_accounts_id_fk" FOREIGN KEY ("telegramAccountId") REFERENCES "public"."telegram_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statistics" ADD CONSTRAINT "statistics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_licenseId_licenses_id_fk" FOREIGN KEY ("licenseId") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;