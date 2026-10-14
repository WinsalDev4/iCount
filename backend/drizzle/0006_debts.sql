CREATE TABLE "debt_payments" (
	"debt_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debt_payments_debt_id_transaction_id_pk" PRIMARY KEY("debt_id","transaction_id")
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"principal_minor" bigint NOT NULL,
	"annual_rate_bps" integer NOT NULL,
	"apr_bps" integer,
	"monthly_payment_minor" bigint NOT NULL,
	"start_date" date NOT NULL,
	"term_months" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debts_household_id_idx" ON "debts" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE set null ON UPDATE no action;