-- Create station_prices table for individual station pricing
CREATE TABLE IF NOT EXISTS "public"."station_prices" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "station_id" uuid NOT NULL,
    "date" date NOT NULL,
    "prices" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "station_prices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "station_prices_user_id_station_id_date_key" UNIQUE ("user_id", "station_id", "date"),
    CONSTRAINT "station_prices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "station_prices_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."postos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_station_prices_station_id" ON "public"."station_prices" USING "btree" ("station_id");
CREATE INDEX IF NOT EXISTS "idx_station_prices_date" ON "public"."station_prices" USING "btree" ("date");
CREATE INDEX IF NOT EXISTS "idx_station_prices_user_id" ON "public"."station_prices" USING "btree" ("user_id");

-- Add RLS policies
ALTER TABLE "public"."station_prices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own station prices" ON "public"."station_prices"
    FOR SELECT USING ("user_id" = auth.uid());

CREATE POLICY "Users can insert their own station prices" ON "public"."station_prices"
    FOR INSERT WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "Users can update their own station prices" ON "public"."station_prices"
    FOR UPDATE USING ("user_id" = auth.uid());

CREATE POLICY "Users can delete their own station prices" ON "public"."station_prices"
    FOR DELETE USING ("user_id" = auth.uid());

-- Grant permissions
GRANT ALL ON "public"."station_prices" TO "anon";
GRANT ALL ON "public"."station_prices" TO "authenticated";
