
CREATE TYPE public.client_region AS ENUM ('bruxelles', 'wallonie', 'flandre');

ALTER TABLE public.clients ADD COLUMN region public.client_region NULL;
