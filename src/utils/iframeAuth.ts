import { User, Session } from '@supabase/supabase-js'

/**
 * Iframe Authentication Utilities
 * 
 * This file provides helper functions for managing authentication state
 * between an embedded iframe app and its parent window.
 */

export interface IframeAuthMessage {
  type: 'REQUEST_AUTH' | 'STORE_AUTH' | 'CLEAR_AUTH' | 'AUTH_RESPONSE'
  data: unknown
}

export interface AuthData {
  user: User | null
  session: Session | null
}

/**
 * Parent Window Implementation Example:
 * 
 * ```javascript
 * // In the parent window that contains the iframe
 * 
 * // Listen for messages from the iframe
 * window.addEventListener('message', (event) => {
 *   const { type, data } = event.data;
 *   
 *   switch (type) {
 *     case 'REQUEST_AUTH':
 *       // Retrieve stored auth data from parent's storage
 *       const storedAuth = localStorage.getItem('iframe_auth');
 *       if (storedAuth) {
 *         const authData = JSON.parse(storedAuth);
 *         // Send auth data back to iframe
 *         event.source.postMessage({
 *           type: 'AUTH_RESPONSE',
 *           data: authData
 *         }, event.origin);
 *       }
 *       break;
 *       
 *     case 'STORE_AUTH':
 *       // Store auth data in parent's storage
 *       localStorage.setItem('iframe_auth', JSON.stringify(data));
 *       break;
 *       
 *     case 'CLEAR_AUTH':
 *       // Clear stored auth data
 *       localStorage.removeItem('iframe_auth');
 *       break;
 *   }
 * });
 * ```
 */

/**
 * Check if the current window is running inside an iframe
 */
export const isInIframe = (): boolean => {
  try {
    return window !== window.parent
  } catch {
    return true
  }
}

/**
 * Send a message to the parent window
 */
export const sendMessageToParent = (type: IframeAuthMessage['type'], data: unknown): void => {
  if (isInIframe() && window.parent) {
    window.parent.postMessage({ type, data }, '*')
  }
}

/**
 * Request authentication data from the parent window
 */
export const requestAuthFromParent = (): Promise<AuthData | null> => {
  return new Promise((resolve) => {
    if (!isInIframe()) {
      resolve(null)
      return
    }

    const messageHandler = (event: MessageEvent<IframeAuthMessage>) => {
      if (event.data.type === 'AUTH_RESPONSE') {
        window.removeEventListener('message', messageHandler)
        resolve(event.data.data as AuthData)
      }
    }

    window.addEventListener('message', messageHandler)
    sendMessageToParent('REQUEST_AUTH', null)

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener('message', messageHandler)
      resolve(null)
    }, 5000)
  })
}

/**
 * Store authentication data in the parent window
 */
export const storeAuthInParent = (user: AuthData['user'], session: AuthData['session']): void => {
  if (isInIframe()) {
    sendMessageToParent('STORE_AUTH', { user, session })
  }
}

/**
 * Clear authentication data from the parent window
 */
export const clearAuthInParent = (): void => {
  if (isInIframe()) {
    sendMessageToParent('CLEAR_AUTH', null)
  }
}

/**
 * Refresh the session and update parent window storage
 * This should be called when the session is refreshed
 */
export const refreshSessionInParent = (user: User | null, session: Session | null): void => {
  if (isInIframe()) {
    sendMessageToParent('STORE_AUTH', { user, session })
  }
}
