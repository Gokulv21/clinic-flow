-- Migration to add clinic blocking functionality
-- 1. Add columns to clinics table
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS block_reason TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- 2. Create clinic_block_history table
CREATE TABLE IF NOT EXISTS public.clinic_block_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'blocked' or 'unblocked'
  reason TEXT,
  action_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.clinic_block_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for history
DROP POLICY IF EXISTS "Superadmins can manage all block history" ON public.clinic_block_history;
CREATE POLICY "Superadmins can manage all block history"
  ON public.clinic_block_history
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true));

DROP POLICY IF EXISTS "Clinic owners can view their own block history" ON public.clinic_block_history;
CREATE POLICY "Clinic owners can view their own block history"
  ON public.clinic_block_history
  FOR SELECT
  TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR 
    clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid())
  );


-- 5. Update RLS for clinics to allow superadmin to update blocking status
DROP POLICY IF EXISTS "Superadmins can update clinics" ON public.clinics;
CREATE POLICY "Superadmins can update clinics"
  ON public.clinics
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true));
