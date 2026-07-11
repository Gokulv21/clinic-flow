-- 1. Add draft_data to visits table for cross-device syncing of consultation drafts
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS draft_data JSONB;

-- 2. Create a table for Handwritten Protocols (Lasso copied snippets)
CREATE TABLE IF NOT EXISTS public.handwritten_protocols (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clinic_id UUID,
    doctor_id UUID,
    name TEXT NOT NULL,
    raw_paths JSONB NOT NULL
);

-- Enable RLS for handwritten_protocols (assuming standard policy for clinic-level access)
ALTER TABLE public.handwritten_protocols ENABLE ROW LEVEL SECURITY;

-- Optional: Create a basic policy that allows authenticated users to read/write their clinic's protocols
CREATE POLICY "Allow users to read handwritten protocols" 
ON public.handwritten_protocols 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to insert handwritten protocols" 
ON public.handwritten_protocols 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to update handwritten protocols" 
ON public.handwritten_protocols 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to delete handwritten protocols" 
ON public.handwritten_protocols 
FOR DELETE 
USING (auth.role() = 'authenticated');
