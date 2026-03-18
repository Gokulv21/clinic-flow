import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAge(ageInYears: number | string | null | undefined): string {
    if (ageInYears === null || ageInYears === undefined || ageInYears === '') return '—';
    const years = typeof ageInYears === 'string' ? parseFloat(ageInYears) : ageInYears;
    
    if (years >= 1) {
        return Math.floor(years) + 'y';
    }
    
    const days = Math.round(years * 365);
    if (days < 90) {
        return (days || 0) + 'd';
    }
    
    const months = Math.round(years * 12);
    return (months || 0) + 'm';
}
