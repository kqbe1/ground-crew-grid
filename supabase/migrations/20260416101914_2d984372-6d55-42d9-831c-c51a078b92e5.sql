
-- Add new columns to intervention_sheets for multi-step forms

-- Nameplate / technical data
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS nameplate_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS photos_nameplate text[] DEFAULT '{}'::text[];

-- Supplies
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS supplies_description text;

-- Internal (excluded from client PDF)
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS internal_comment text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS internal_photos text[] DEFAULT '{}'::text[];

-- Observations before
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS observations_before text;

-- Billing override
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_same_as_intervention boolean DEFAULT true;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_name text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_address text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_postal_code text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_city text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_phone text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS billing_email text;

-- Client coordinates override (editable from pre-filled values)
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS client_name_override text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS client_address_override text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS client_postal_override text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS client_city_override text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS client_phone_override text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS client_email_override text;

-- Entretien specific
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS entretien_type text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS entretien_subtype jsonb DEFAULT '{}'::jsonb;

-- Binome info
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS binome_name text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS binome_percentage integer;

-- Extended status
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS work_status_detail text;
ALTER TABLE public.intervention_sheets ADD COLUMN IF NOT EXISTS status_comment text;
