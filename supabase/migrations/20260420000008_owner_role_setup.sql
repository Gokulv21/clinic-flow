-- PART 1: EVOLVE APP_ROLE ENUM
-- This must be run/committed SEPARATELY before using the 'owner' value.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
