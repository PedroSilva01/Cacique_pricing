-- Add flags to mark maintained prices (when supplier doesn't have product or didn't send price)
-- This helps handle cases where:
-- 1. Product is out of stock - price is maintained from last valid date
-- 2. Supplier didn't send price update - last price is used
-- 3. Need to track which prices are current vs maintained

-- Add columns to daily_prices table
ALTER TABLE daily_prices
ADD COLUMN IF NOT EXISTS maintained_prices JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS price_notes TEXT;

-- maintained_prices structure: { "fuel_type_key": "YYYY-MM-DD" }
-- Example: { "diesel_s10": "2025-11-30", "gasoline": null }
-- If a fuel type has a date, that date is when the price was originally set (maintained from that date)
-- null or missing key means the price is current/fresh for this date

-- Add comment to explain the columns
COMMENT ON COLUMN daily_prices.maintained_prices IS 
'JSON object marking which fuel types have maintained prices from previous dates. Format: {"fuel_key": "original_date"}. If present, price is from that date (out of stock/not updated).';

COMMENT ON COLUMN daily_prices.price_notes IS 
'Optional notes about prices (e.g., "Produto em falta desde 20/11", "Fornecedor não enviou atualização")';

-- Create index for querying fresh prices only (where maintained_prices is empty)
CREATE INDEX IF NOT EXISTS idx_daily_prices_fresh 
ON daily_prices (supplier_id, base_city_id, date) 
WHERE maintained_prices IS NULL OR maintained_prices = '{}';

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_daily_prices_date_range 
ON daily_prices (date DESC, supplier_id, base_city_id);
