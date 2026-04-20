-- 1. STORAGE BUCKET HARDENING
-- Enforce MIME types and size limits globally for specific buckets.

-- This migration assumes the buckets 'avatars' and 'prescriptions' exist.
-- We use a check constraint on the storage.objects table if possible, 
-- or a trigger-based approach if bucket-specific constraints are needed.

CREATE OR REPLACE FUNCTION public.validate_storage_upload()
RETURNS TRIGGER AS $$
BEGIN
    -- [Rule 1] Global File Size Limit: 5MB
    IF NEW.metadata->>'size' IS NOT NULL AND (NEW.metadata->>'size')::int > 5242880 THEN
        RAISE EXCEPTION 'File size exceeds 5MB limit.';
    END IF;

    -- [Rule 2] Avatars: Only common image formats
    IF NEW.bucket_id = 'avatars' THEN
        IF NEW.metadata->>'mimetype' NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
            RAISE EXCEPTION 'Invalid file type for avatars. Use JPEG, PNG, or WEBP.';
        END IF;
    END IF;

    -- [Rule 3] Prescriptions: Images or PDF
    IF NEW.bucket_id = 'prescriptions' THEN
        IF NEW.metadata->>'mimetype' NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
            RAISE EXCEPTION 'Invalid file type for prescriptions. Use Image or PDF.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to storage.objects (Supabase internal schema)
-- Note: 'storage' schema triggers are allowed in Supabase for hardening.
DROP TRIGGER IF EXISTS storage_safety_validator ON storage.objects;
CREATE TRIGGER storage_safety_validator
BEFORE INSERT OR UPDATE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.validate_storage_upload();


-- 2. DATABASE CONSTRAINT HARDENING
-- Enforce basic data integrity for sensitive fields.

-- Patient Age checks
-- First, normalize any existing invalid data to avoid constraint violations
UPDATE public.patients
SET age = CASE 
    WHEN age < 0 THEN 0 
    WHEN age > 150 THEN 150 
    ELSE age 
END
WHERE age < 0 OR age > 150;

ALTER TABLE public.patients
ADD CONSTRAINT check_patient_age_range
CHECK (age >= 0 AND age <= 150);

-- Role constraints (already enforced by foreign keys/enums usually, but let's be strict)
ALTER TABLE public.user_roles
ADD CONSTRAINT check_role_validity
CHECK (role::text IN ('doctor', 'nurse', 'staff', 'owner', 'printer'));

-- Profile name non-empty
ALTER TABLE public.profiles
ADD CONSTRAINT check_profile_name_not_empty
CHECK (char_length(trim(full_name)) >= 2);
