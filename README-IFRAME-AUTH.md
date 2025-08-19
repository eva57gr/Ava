# Iframe Authentication System

This project has been enhanced to support storing authentication information in the parent browser's storage when embedded as an iframe. This allows the parent application to maintain authentication state across iframe reloads and provides a seamless user experience.

## How It Works

The iframe authentication system uses the `postMessage` API to communicate between the embedded iframe and the parent window. When authentication state changes (login, logout, etc.), the iframe sends messages to the parent window to store or retrieve authentication data.

**Key Features:**
- **Session Restoration**: When the iframe loads, it retrieves stored auth data from the parent and restores the Supabase session
- **Automatic Refresh**: The system automatically refreshes expired sessions and updates the parent window
- **Persistent State**: Authentication state persists across iframe reloads and parent window reloads

## Message Types

The system uses the following message types for communication:

- `REQUEST_AUTH`: Iframe requests stored authentication data from parent
- `STORE_AUTH`: Iframe sends authentication data to parent for storage
- `CLEAR_AUTH`: Iframe requests parent to clear stored authentication data
- `AUTH_RESPONSE`: Parent responds with stored authentication data

## Session Refresh Handling

The system automatically handles session refresh to maintain persistent authentication:

1. **Automatic Refresh**: Sessions are refreshed 5 minutes before expiration
2. **Parent Update**: Refreshed sessions are automatically sent to the parent window
3. **Seamless Experience**: Users stay logged in without manual intervention

## Parent Window Implementation

To use this system, the parent window that contains the iframe must implement a message listener. Here's a complete example:

```javascript
// In the parent window that contains the iframe

// Listen for messages from the iframe
window.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'REQUEST_AUTH':
      // Retrieve stored auth data from parent's storage
      const storedAuth = localStorage.getItem('iframe_auth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        // Send auth data back to iframe
        event.source.postMessage({
          type: 'AUTH_RESPONSE',
          data: authData
        }, event.origin);
      }
      break;
      
    case 'STORE_AUTH':
      // Store auth data in parent's storage
      localStorage.setItem('iframe_auth', JSON.stringify(data));
      break;
      
    case 'CLEAR_AUTH':
      // Clear stored auth data
      localStorage.removeItem('iframe_auth');
      break;
  }
});
```

## Alternative Storage Methods

Instead of `localStorage`, you can use other storage methods in the parent window:

### SessionStorage
```javascript
// Use sessionStorage for session-only storage
sessionStorage.setItem('iframe_auth', JSON.stringify(data));
```

### Custom Storage
```javascript
// Use your own storage solution
myCustomStorage.set('iframe_auth', data);
```

### Secure Storage
```javascript
// For sensitive data, consider encrypted storage
const encryptedData = encrypt(JSON.stringify(data));
localStorage.setItem('iframe_auth', encryptedData);
```

## Security Considerations

1. **Origin Validation**: Consider validating the origin of messages in production:
   ```javascript
   if (event.origin !== 'https://your-iframe-domain.com') {
     return; // Reject messages from unknown origins
   }
   ```

2. **Data Validation**: Validate the structure of incoming authentication data before storing it.

3. **Token Expiration**: Implement token expiration checks in the parent window.

4. **HTTPS**: Always use HTTPS in production to secure communication.

## Usage in React Components

The `useAuth` hook now includes an `isInIframe` property that you can use to conditionally render content:

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isInIframe } = useAuth();
  
  return (
    <div>
      {isInIframe && <p>Running in iframe mode</p>}
      {user ? <p>Welcome, {user.email}!</p> : <p>Please log in</p>}
    </div>
  );
}
```

## Testing

To test the iframe authentication system:

1. Create a simple HTML page with the parent window implementation
2. Embed your React app as an iframe
3. Test login/logout functionality
4. Verify that authentication state persists in the parent's storage
5. Test iframe reload to ensure authentication state is restored

## Troubleshooting

### Common Issues

1. **Messages not being received**: Ensure the parent window has the message listener set up
2. **Authentication not persisting**: Check that the parent window is properly storing the data
3. **Type errors**: Verify that the authentication data structure matches the expected format

### Debug Mode

Enable console logging in the parent window to debug message flow:

```javascript
window.addEventListener('message', (event) => {
  console.log('Received message:', event.data);
  // ... rest of your handler
});
```

## API Reference

### `useAuth()` Hook

Returns an object with:
- `user`: Current user object or null
- `session`: Current session object or null
- `loading`: Boolean indicating if auth state is being determined
- `signUp`: Function to sign up a new user
- `signIn`: Function to sign in an existing user
- `signOut`: Function to sign out the current user
- `resetPassword`: Function to reset password
- `isInIframe`: Boolean indicating if running in iframe mode

### Utility Functions

- `isInIframe()`: Check if current window is in iframe
- `sendMessageToParent(type, data)`: Send message to parent window
- `requestAuthFromParent()`: Request auth data from parent
- `storeAuthInParent(user, session)`: Store auth data in parent
- `clearAuthInParent()`: Clear auth data from parent
