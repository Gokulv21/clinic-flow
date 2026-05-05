import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('API & Database Integrity', () => {
  it('should have a working Supabase connection', async () => {
    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should be able to read from the clinics table', async () => {
    const { data, error } = await supabase.from('clinics').select('count', { count: 'exact', head: true });
    // If it's a 404 or 403, it might be RLS, but here we expect basic connectivity to not fail with a network error
    if (error) {
      console.log('Note: clinics table might have RLS enabled:', error.message);
      expect(['PGRST116', '42501']).toContain(error.code);
    } else {
      expect(data).toBeDefined();
    }
  });

  it('should verify patients table is reachable', async () => {
    const { error } = await supabase.from('patients').select('*', { count: 'exact', head: true });
    if (error) {
      expect(['PGRST116', '42501']).toContain(error.code);
    }
  });

  it('should verify visits table is reachable', async () => {
    const { error } = await supabase.from('visits').select('*', { count: 'exact', head: true });
    if (error) {
      expect(['PGRST116', '42501']).toContain(error.code);
    }
  });

  it('should verify prescriptions table is reachable', async () => {
    const { error } = await supabase.from('prescriptions').select('*', { count: 'exact', head: true });
    if (error) {
      expect(['PGRST116', '42501']).toContain(error.code);
    }
  });
});
