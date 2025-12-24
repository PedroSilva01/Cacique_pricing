-- Criar tabela de veículos
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate varchar(10) NOT NULL,
  vehicle_type text NOT NULL, -- toco, truck, carreta, bitrem, rodotrem
  capacity_liters integer NOT NULL,
  axis_count integer NOT NULL,
  driver_name text,
  freight_rates jsonb DEFAULT '{}', -- frete por posto: { "posto_id": valor }
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, plate)
);

-- RLS policies
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vehicles"
  ON public.vehicles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vehicles"
  ON public.vehicles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicles"
  ON public.vehicles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicles"
  ON public.vehicles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Índices
CREATE INDEX idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_plate ON public.vehicles(plate);

COMMENT ON TABLE public.vehicles IS 'Cadastro de veículos de entrega com taxas de frete por destino';
COMMENT ON COLUMN public.vehicles.vehicle_type IS 'Tipo: toco, truck, carreta, bitrem, rodotrem';
COMMENT ON COLUMN public.vehicles.capacity_liters IS 'Capacidade em litros';
COMMENT ON COLUMN public.vehicles.axis_count IS 'Quantidade de eixos';
COMMENT ON COLUMN public.vehicles.freight_rates IS 'Taxas de frete por posto: {"posto_id": valor}';
