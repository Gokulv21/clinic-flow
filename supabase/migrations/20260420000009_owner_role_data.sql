-- PART 2: DATA PROMOTION & CONSTRAINTS
-- RUN THIS ONLY AFTER PART 1 HAS BEEN SUCCESSFULLY COMMITTED.

-- 1. UPDATE ROLE VALIDATION CONSTRAINTS
-- Relax the constraints on BOTH tables to include the 'owner' value.

-- Fix user_roles constraint
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS check_role_validity;

ALTER TABLE public.user_roles
ADD CONSTRAINT check_role_validity
CHECK (role::text IN ('doctor', 'nurse', 'staff', 'owner', 'printer'));

-- Fix profiles constraint (this was causing the error 23514)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role::text IN ('doctor', 'nurse', 'staff', 'owner', 'printer'));


-- 2. PROMOTE SPECIFIC USER TO OWNER
-- Target 'arvnd14@gmail.com' specifically.

-- Update user_roles
UPDATE public.user_roles
SET role = 'owner'
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'arvnd14@gmail.com'
);

-- Update profiles
UPDATE public.profiles
SET role = 'owner'
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'arvnd14@gmail.com'
);


-- 3. PERMISSIONS LOG
INSERT INTO public.security_audit_logs (event_type, actor_id, metadata)
VALUES (
    'ROLE_CHANGE', 
    auth.uid(), 
    jsonb_build_object(
        'reason', 'Targeted Owner Promotion (Precision)',
        'target_email', 'arvnd14@gmail.com',
        'new_role', 'owner'
    )
);
