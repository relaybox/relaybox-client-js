import { ValidationError } from './errors';

const USER_DATA_MAX_SIZE = 1024;

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
