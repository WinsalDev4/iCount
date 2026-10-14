CREATE TABLE "push_tickets" (
	"receipt_id" varchar(64) PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(8) NOT NULL,
	"device_name" varchar(80),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_tickets_sent_at_idx" ON "push_tickets" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens" USING btree ("user_id");