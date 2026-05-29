-- Add created_by column to visits table to track the staff member who registered the patient
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Enable insert policy for notifications so authenticated users (like doctors) can insert them
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
CREATE POLICY "Enable insert for authenticated users" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);
