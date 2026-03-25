-- Allow ONLY doctors to delete patients (needed for No-Show cleanup of 0-visit patients)
CREATE POLICY "Doctors Can Delete Patients" ON public.patients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));
