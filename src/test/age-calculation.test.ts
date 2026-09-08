import { describe, it, expect } from 'vitest';
import { calculateDobFromAge, calculateAgeFromDob, getPatientCurrentAge, formatAge, formatPrescriptionAge } from '@/lib/utils';

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

    const pastVisitDate = new Date('2023-09-08T00:00:00Z');
    expect(formatAge(patient, pastVisitDate)).toBe('10y');

    const currentVisitDate = new Date('2026-09-08T00:00:00Z');
    expect(formatAge(patient, currentVisitDate)).toBe('13y');
  });

  it('should format detailed years and months (e.g. 22y 1m) in general directory', () => {
    const patient = {
      dob: '2004-08-08',
      created_at: '2026-08-08T00:00:00Z',
      age: 22
    };

    const nextMonthVisit = new Date('2026-09-08T00:00:00Z');
    expect(formatAge(patient, nextMonthVisit)).toBe('22y 1m');
  });

  it('should format whole integer numbers in prescriptions for adults (e.g. 42y9m -> 42y)', () => {
    // 42 years and 9 months
    const adultPatient = {
      dob: '1983-12-08',
      created_at: '2026-09-08T00:00:00Z',
      age: 42.75
    };
    const refDate = new Date('2026-09-08T00:00:00Z');
    // General directory shows 42y 9m
    expect(formatAge(adultPatient, refDate)).toBe('42y 9m');
    // Prescription shows clean whole years: 42y
    expect(formatPrescriptionAge(adultPatient, refDate)).toBe('42y');
  });

  it('should format days under 30/31 days and switch to months once passed 1 month in prescription', () => {
    // 1. Baby 20 days old (born 2026-08-19, visit 2026-09-08)
    const baby20Days = {
      dob: '2026-08-19',
      created_at: '2026-08-19T00:00:00Z',
      age: 0.05
    };
    const visitDate = new Date('2026-09-08T00:00:00Z');
    expect(formatPrescriptionAge(baby20Days, visitDate)).toBe('20d');

    // 2. Baby 52 days old (1 month and 22 days) -> switches to 1m
    const baby52Days = {
      dob: '2026-07-18',
      created_at: '2026-07-18T00:00:00Z',
      age: 0.14
    };
    expect(formatPrescriptionAge(baby52Days, visitDate)).toBe('1m');

    // 3. Baby 82 days old (2 months and 22 days) -> switches to 2m
    const baby82Days = {
      dob: '2026-06-18',
      created_at: '2026-06-18T00:00:00Z',
      age: 0.22
    };
    expect(formatPrescriptionAge(baby82Days, visitDate)).toBe('2m');
  });
});

