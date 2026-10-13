CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text" varchar(500) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
