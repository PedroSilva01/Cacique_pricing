-- Fix financial cost rate to correct value (0.535 cents = R$ 0.00535)
UPDATE user_settings 
SET financial_cost_rate = 0.00535 
WHERE financial_cost_rate IS NOT NULL;

-- Set default for any null values
UPDATE user_settings 
SET financial_cost_rate = 0.00535 
WHERE financial_cost_rate IS NULL;
