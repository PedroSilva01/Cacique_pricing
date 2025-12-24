-- Add target_prices to groups table
ALTER TABLE "public"."groups" 
ADD COLUMN target_prices jsonb DEFAULT '{}'::jsonb;

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "station_id" uuid NOT NULL,
    "group_id" uuid NOT NULL,
    "order_date" date NOT NULL,
    "fuel_type" text NOT NULL,
    "volume" numeric NOT NULL, -- in cubic meters
    "unit_price" numeric NOT NULL, -- price per liter
    "payment_term_days" integer NOT NULL DEFAULT 0, -- days for payment
    "financial_cost_rate" numeric DEFAULT 0, -- monthly rate as decimal (e.g., 0.05 for 5%)
    "daily_financial_cost" numeric GENERATED ALWAYS AS (
        CASE 
            WHEN "payment_term_days" > 0 AND "financial_cost_rate" > 0 
            THEN ("unit_price" * "volume" * 1000 * "financial_cost_rate" * "payment_term_days") / 30
            ELSE 0
        END
    ) STORED,
    "total_cost" numeric GENERATED ALWAYS AS ("unit_price" * "volume" * 1000) STORED,
    "total_with_financial_cost" numeric GENERATED ALWAYS AS (
        ("unit_price" * "volume" * 1000) + 
        CASE 
            WHEN "payment_term_days" > 0 AND "financial_cost_rate" > 0 
            THEN ("unit_price" * "volume" * 1000 * "financial_cost_rate" * "payment_term_days") / 30
            ELSE 0
        END
    ) STORED,
    "target_price" numeric, -- expected price for comparison
    "price_difference" numeric GENERATED ALWAYS AS (
        CASE 
            WHEN "target_price" IS NOT NULL THEN ("unit_price" - "target_price") * "volume" * 1000
            ELSE NULL
        END
    ) STORED,
    "driver_name" text,
    "delivery_date" date,
    "supplier_id" uuid,
    "base_city_id" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_orders_user_id_station_id_order_date_fuel_type_key" UNIQUE ("user_id", "station_id", "order_date", "fuel_type"),
    CONSTRAINT "purchase_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "purchase_orders_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."postos"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "purchase_orders_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "purchase_orders_base_city_id_fkey" FOREIGN KEY ("base_city_id") REFERENCES "public"."base_cities"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_station_id" ON "public"."purchase_orders" USING "btree" ("station_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_group_id" ON "public"."purchase_orders" USING "btree" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_order_date" ON "public"."purchase_orders" USING "btree" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_user_id" ON "public"."purchase_orders" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_price_difference" ON "public"."purchase_orders" USING "btree" ("price_difference");

-- Add RLS policies
ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchase orders" ON "public"."purchase_orders"
    FOR SELECT USING ("user_id" = auth.uid());

CREATE POLICY "Users can insert their own purchase orders" ON "public"."purchase_orders"
    FOR INSERT WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "Users can update their own purchase orders" ON "public"."purchase_orders"
    FOR UPDATE USING ("user_id" = auth.uid());

CREATE POLICY "Users can delete their own purchase orders" ON "public"."purchase_orders"
    FOR DELETE USING ("user_id" = auth.uid());

-- Grant permissions
GRANT ALL ON "public"."purchase_orders" TO "anon";
GRANT ALL ON "public"."purchase_orders" TO "authenticated";

-- Add financial cost rate to user_settings if not exists
ALTER TABLE "public"."user_settings" 
ADD COLUMN IF NOT EXISTS "financial_cost_rate" "numeric" DEFAULT 0.05; -- 5% monthly default
