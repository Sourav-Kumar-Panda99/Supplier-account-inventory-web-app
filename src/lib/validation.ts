/** Small shared form-validation helpers for Server Actions. */

export class ValidationError extends Error {}

export function requiredString(formData: FormData, field: string, label: string): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new ValidationError(`${label} is required.`);
  return value;
}

export function optionalString(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "").trim();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const MIN_PASSWORD_LENGTH = 8;
