/**
 * Common Validation Utilities
 * Requirement 10.3: Extract data validation logic as reusable validators
 */

import { BadRequestError, ValidationError } from '../middleware/errorHandler.js';

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new BadRequestError('Invalid email format');
  }
}

/**
 * Validate stock symbol format
 */
export function validateSymbol(symbol: string): void {
  const symbolRegex = /^[A-Z]{1,5}$/;
  if (!symbolRegex.test(symbol)) {
    throw new BadRequestError('Invalid stock symbol format');
  }
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: Date, endDate: Date): void {
  if (startDate > endDate) {
    throw new BadRequestError('Start date must be before end date');
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, pageSize?: number): {
  page: number;
  pageSize: number;
} {
  const validPage = Math.max(1, page || 1);
  const validPageSize = Math.min(100, Math.max(1, pageSize || 20));

  return { page: validPage, pageSize: validPageSize };
}

/**
 * Validate numeric range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'value'
): void {
  if (value < min || value > max) {
    throw new BadRequestError(`${fieldName} must be between ${min} and ${max}`);
  }
}

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  const errors: Record<string, string[]> = {};

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors[String(field)] = ['This field is required'];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

/**
 * Validate array length
 */
export function validateArrayLength(
  arr: unknown[],
  min: number,
  max: number,
  fieldName: string = 'array'
): void {
  if (arr.length < min || arr.length > max) {
    throw new BadRequestError(`${fieldName} length must be between ${min} and ${max}`);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  str: string,
  min: number,
  max: number,
  fieldName: string = 'string'
): void {
  if (str.length < min || str.length > max) {
    throw new BadRequestError(`${fieldName} length must be between ${min} and ${max}`);
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T>(
  value: T,
  allowedValues: T[],
  fieldName: string = 'value'
): void {
  if (!allowedValues.includes(value)) {
    throw new BadRequestError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}

/**
 * Validate and sanitize user input
 */
export function validateAndSanitize(
  input: string,
  minLength: number = 1,
  maxLength: number = 1000
): string {
  validateStringLength(input, minLength, maxLength, 'input');
  return sanitizeString(input);
}

