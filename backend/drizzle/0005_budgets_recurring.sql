CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"category_id" varchar(36) NOT NULL,
	"month" varchar(7) NOT NULL,
	"limit_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "budgets_household_month_category_unique" UNIQUE("household_id","month","category_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_occurrences" (
	"recurring_payment_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_occurrences_recurring_payment_id_due_date_pk" PRIMARY KEY("recurring_payment_id","due_date")
);
--> statement-breakpoint
CREATE TABLE "recurring_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"type" varchar(8) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"category_id" varchar(36) NOT NULL,
	"rule" jsonb NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_due_date" date,
	"payer_id" uuid NOT NULL,
	"shared" boolean NOT NULL,
	"debt_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurring_payment_id_recurring_payments_id_fk" FOREIGN KEY ("recurring_payment_id") REFERENCES "public"."recurring_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_payments_next_due_date_idx" ON "recurring_payments" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "recurring_payments_household_id_idx" ON "recurring_payments" USING btree ("household_id");