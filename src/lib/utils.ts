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
    
    // Less than 1 year
    const months = Math.round(years * 12);
    if (months >= 1) {
        return months + 'm';
    }
    
    // Less than 1 month
    const days = Math.round(years * 365);
    return (days || 0) + 'd';
}
