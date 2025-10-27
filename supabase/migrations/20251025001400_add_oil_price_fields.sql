-- Add new fields to oil_prices table for storing change percentages and timestamp
ALTER TABLE public.oil_prices 
ADD COLUMN IF NOT EXISTS wti_change text,
ADD COLUMN IF NOT EXISTS brent_change text,
ADD COLUMN IF NOT EXISTS timestamp timestamp with time zone DEFAULT now();

-- Add comment to table
COMMENT ON TABLE public.oil_prices IS 'Stores daily oil prices (WTI and Brent) in USD per barrel';
COMMENT ON COLUMN public.oil_prices.wti_price IS 'WTI crude oil price in USD per barrel';
COMMENT ON COLUMN public.oil_prices.brent_price IS 'Brent crude oil price in USD per barrel';
COMMENT ON COLUMN public.oil_prices.wti_change IS 'WTI price change percentage (e.g., +1.2% or -0.8%)';
COMMENT ON COLUMN public.oil_prices.brent_change IS 'Brent price change percentage (e.g., +1.2% or -0.8%)';
COMMENT ON COLUMN public.oil_prices.timestamp IS 'Timestamp when the price was fetched';
