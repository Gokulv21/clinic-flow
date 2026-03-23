-- Allow doctors to delete visits and prescriptions (needed for No-Show functionality)
CREATE POLICY "Doctors can delete visits" ON public.visits
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Doctors can delete prescriptions" ON public.prescriptions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));
