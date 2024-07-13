export interface AuthRequestOptions {
  method?: 'GET' | 'POST';
  mode?: 'cors' | 'navigate' | 'no-cors' | 'same-origin' | null;
  credentials?: 'include' | 'omit' | 'same-origin' | null;
  cache?: 'no-cache' | 'reload' | 'force-cache' | 'only-if-cached' | null;
  redirect?: 'follow' | 'manual' | 'error' | null;
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | null;
  body?: string;
}

export type AuthParamsOrHeaders = Record<string, unknown> | (() => Record<string, unknown> | null);
