import { describe, it, expect } from 'vitest';
import { calculateDobFromAge, calculateAgeFromDob, getPatientCurrentAge, formatAge } from '@/lib/utils';

describe('Dynamic Age and DOB Calculation Engine', () => {
  it('should auto-derive approximate DOB from entered age in years', () => {
    const refDate = new Date('2026-09-08T12:00:00Z');
    const dob = calculateDobFromAge(10, 'years', refDate);
    expect(dob).toBe('2016-09-08');
  });

  it('should auto-derive approximate DOB from entered age in months', () => {
    const refDate = new Date('2026-09-08T12:00:00Z');
    const dob = calculateDobFromAge(6, 'months', refDate);
    expect(dob).toBe('2026-03-08');
  });

  it('should auto-derive approximate DOB from entered age in days', () => {
    const refDate = new Date('2026-09-08T12:00:00Z');
    const dob = calculateDobFromAge(20, 'days', refDate);
    expect(dob).toBe('2026-08-19');
  });

  it('should accurately calculate current age from DOB', () => {
    const dob = '2016-09-08';
    const refDate = new Date('2026-09-08T12:00:00Z');
    const age = calculateAgeFromDob(dob, refDate);
    expect(age).toBe(10);
  });

  it('should increment age when returning 3 years later', () => {
    // Patient was 10 years old when registered on 2023-01-01 (DOB approx 2013-01-01)
    const patientWithDob = {
      dob: '2013-01-01',
      created_at: '2023-01-01T00:00:00Z',
      age: 10
    };

    const futureVisitDate = new Date('2026-01-01T00:00:00Z'); // 3 years later
    const dynamicAge = getPatientCurrentAge(patientWithDob, futureVisitDate);
    expect(dynamicAge).toBe(13);
    expect(formatAge(patientWithDob, futureVisitDate)).toBe('13y');
  });

  it('should handle legacy patients without DOB using created_at fallback', () => {
    // Legacy record: only has age: 10 and created_at 3 years ago
    const legacyPatient = {
      dob: null,
      age: 10,
      created_at: '2023-09-08T00:00:00Z'
    };

    const currentDate = new Date('2026-09-08T00:00:00Z');
    const calculatedAge = getPatientCurrentAge(legacyPatient, currentDate);
    expect(calculatedAge).toBe(13);
    expect(formatAge(legacyPatient, currentDate)).toBe('13y');
  });

  it('should preserve past prescription age based on historical visit date', () => {
    const patient = {
      dob: '2013-09-08',
      created_at: '2023-09-08T00:00:00Z',
      age: 10
    };

    // Past consultation in 2023
    const pastVisitDate = new Date('2023-09-08T00:00:00Z');
    expect(formatAge(patient, pastVisitDate)).toBe('10y');

    // Current consultation in 2026
    const currentVisitDate = new Date('2026-09-08T00:00:00Z');
    expect(formatAge(patient, currentVisitDate)).toBe('13y');
  });

  it('should format detailed years and months (e.g. 22y 1m) when patient visits next month', () => {
    // Patient registered at age 22 on 2026-08-08
    const patient = {
      dob: '2004-08-08',
      created_at: '2026-08-08T00:00:00Z',
      age: 22
    };

    // Patient visits exactly 1 month later on 2026-09-08
    const nextMonthVisit = new Date('2026-09-08T00:00:00Z');
    expect(formatAge(patient, nextMonthVisit)).toBe('22y 1m');

    // Patient visits 5 months later
    const fiveMonthsVisit = new Date('2027-01-08T00:00:00Z');
    expect(formatAge(patient, fiveMonthsVisit)).toBe('22y 5m');
  });
});

