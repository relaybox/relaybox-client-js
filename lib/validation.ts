import { ValidationError } from './errors';

const USER_DATA_MAX_SIZE = 1024;
const STRING_LENGTH_MIN = 5;

export function validateUserData(userData: any, maxSize?: number): boolean {
  if (!userData) {
    throw new ValidationError('No data to be published');
  }
  const dataString = JSON.stringify(userData);

  if (new TextEncoder().encode(dataString).length > (maxSize || USER_DATA_MAX_SIZE)) {
    throw new ValidationError('Data exceeds the maximum size limit');
  }

  if (!/^[a-zA-Z0-9 \r\n,.!?;:'"(){}\[\]@#$%^&*+=<>\/\\-]*$/.test(dataString)) {
    throw new ValidationError('Data contains unsafe characters');
  }

  return true;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email address');
  }

  return true;
}

export function validateStringLength(value: string, length: number = STRING_LENGTH_MIN): boolean {
  if (value.length < length) {
    throw new ValidationError('String less than the minimum length');
  }

  return true;
}
