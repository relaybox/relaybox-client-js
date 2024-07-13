/**
 * Retrieves the value of the specified item from local storage.
 * @param {string} key - The key of the item to retrieve.
 * @returns {string | null} The value of the item, or null if the item does not exist.
 */
export function getItem(key: string): string | null {
  return localStorage.getItem(key);
}

/**
 * Sets the value of the specified item in local storage.
 * @param {string} key - The key of the item to set.
 * @param {any} value - The value to store.
 * @param {number} [ttl] - Optional time-to-live in milliseconds. Not implemented but can be used for future enhancements.
 * @returns {void}
 */
export function setItem(key: string, value: any, ttl?: number): void {
  return localStorage.setItem(key, value);
}

/**
 * Removes the specified item from local storage.
 * @param {string} key - The key of the item to remove.
 * @returns {void}
 */
export function removeItem(key: string): void {
  return localStorage.removeItem(key);
}
