/**
 * SECURITY SANITIZATION UTILITIES
 * Centralized logic to prevent XSS, script injection, and ensure data integrity.
 */

/**
 * Strips HTML tags and trims whitespace from a string.
 * Also enforces a maximum length to prevent DOS/Database bloat.
 */
export const sanitizeText = (input: string, maxLength: number = 2000): string => {
  if (!input) return "";
  
  // 1. Strip HTML tags (basic RegEx)
  let clean = input.replace(/<\/?[^>]+(>|$)/g, "");

  // 2. Remove potentially dangerous characters / script starters if they look like HTML entities
  clean = clean.replace(/[<>]/g, "");

  // 3. Trim and limit length
  return clean.trim().substring(0, maxLength);
};

/**
 * Validates a phone number pattern.
 * Allows common formats (e.g., +91..., 10 digits, etc.)
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return true; // Optional field usually
  const phoneRegex = /^\+?[\d\s-]{10,15}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * Validates numeric range for age, vitals, etc.
 */
export const validateNumericRange = (val: string | number, min: number, max: number): boolean => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return false;
  return num >= min && num <= max;
};

/**
 * Sanitizes filenames to prevent path injection characters.
 */
export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
};

/**
 * Global input schema validation helper (Lightweight alternative to Zod)
 */
export const validateInputs = (inputs: Record<string, any>, rules: Record<string, { required?: boolean, type?: 'string' | 'number', min?: number, max?: number, pattern?: RegExp }>) => {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(rules)) {
    const val = inputs[key];
    
    if (value.required && (val === undefined || val === null || val === '')) {
      errors.push(`${key} is required`);
    }

    if (val && value.pattern && !value.pattern.test(String(val))) {
      errors.push(`Invalid format for ${key}`);
    }

    if (val && value.type === 'number' && typeof val !== 'number') {
      const num = parseFloat(val);
      if (isNaN(num)) {
        errors.push(`${key} must be a number`);
      } else if (value.min !== undefined && num < value.min) {
        errors.push(`${key} is too low (min: ${value.min})`);
      } else if (value.max !== undefined && num > value.max) {
        errors.push(`${key} is too high (max: ${value.max})`);
      }
    }
  }

  return { 
    isValid: errors.length === 0, 
    errors 
  };
};
