import { StorageType } from './types/storage.types';

export function getItem(key: string, storageType?: StorageType): string | null {
  let item;

  if (storageType === StorageType.SESSION) {
    item = sessionStorage.getItem(key);
  } else {
    item = localStorage.getItem(key);
  }

  if (!item) {
    return null;
  }

  try {
    const parsedItem = JSON.parse(item);

    if (parsedItem.expiresAt && parsedItem.expiresAt < new Date().getTime()) {
      removeItem(key, storageType);
      return null;
    }

    return item;
  } catch (err) {
    return null;
  }
}

export function setItem(key: string, value: string, storageType?: StorageType): void {
  if (storageType === StorageType.SESSION) {
    return sessionStorage.setItem(key, value);
  }

  localStorage.setItem(key, value);
}

export function removeItem(key: string, storageType?: StorageType): void {
  if (storageType === StorageType.SESSION) {
    return sessionStorage.removeItem(key);
  }

  localStorage.removeItem(key);
}
