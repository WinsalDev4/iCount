CREATE TABLE "advisor_applied_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"insight_id" uuid,
	"plan_id" uuid,
	"action" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_consents" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"granted" boolean NOT NULL,
	"version" integer NOT NULL,
	"granted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "advisor_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(9) NOT NULL,
	"content" text NOT NULL,
	"plan" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_reports" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"fingerprint" varchar(80) NOT NULL,
	"report" jsonb NOT NULL,
	"generated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisor_applied_actions" ADD CONSTRAINT "advisor_applied_actions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_applied_actions" ADD CONSTRAINT "advisor_applied_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_consents" ADD CONSTRAINT "advisor_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_conversations" ADD CONSTRAINT "advisor_conversations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_conversations" ADD CONSTRAINT "advisor_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_conversation_id_advisor_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."advisor_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_reports" ADD CONSTRAINT "advisor_reports_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_conversations_user_idx" ON "advisor_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "advisor_conversations_last_message_idx" ON "advisor_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "advisor_messages_conversation_idx" ON "advisor_messages" USING btree ("conversation_id","created_at");