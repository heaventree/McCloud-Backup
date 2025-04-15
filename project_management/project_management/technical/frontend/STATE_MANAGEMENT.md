# State Management Best Practices for Payymo

This document outlines the state management principles and patterns to be used in the Payymo financial platform. Consistent state management is crucial for maintaining application reliability, performance, and developer productivity.

## 1. State Management Philosophy

### Core Principles

1. **Single Source of Truth**: Each piece of data should be stored in only one place
2. **Immutability**: State should never be mutated directly
3. **Unidirectional Data Flow**: State changes follow a predictable pattern
4. **Minimal State**: Store only what's necessary; derive the rest
5. **Structured Actions**: State changes occur through defined actions

### State Categories

State in Payymo is categorized into four types:

1. **Server State**: Data retrieved from API endpoints (transactions, bank connections)
2. **UI State**: Visual state like modals, alerts, navigation menus
3. **Form State**: User inputs, validation, drafts
4. **App State**: Authentication, user preferences, permissions

## 2. State Management Architecture

### Client-Side State Management

Payymo uses Flask/Jinja2 templates for primary rendering with JavaScript for interactivity. Our state management must work within this architecture.

#### For Server-Rendered Pages

- Use JavaScript data attributes to pass initial state to client-side scripts
- Implement a lightweight custom state management implementation
- Keep DOM as source of truth where appropriate

```html
<!-- Example of using data attributes for state -->
<div id="transaction-list" 
     data-currency="USD"
     data-account-id="acc_12345"
     data-refresh-interval="60">
  <!-- Transaction items -->
</div>
```

```javascript
// Initialize state from DOM
const transactionListEl = document.getElementById('transaction-list');
const state = {
  currency: transactionListEl.dataset.currency,
  accountId: transactionListEl.dataset.accountId,
  refreshInterval: parseInt(transactionListEl.dataset.refreshInterval, 10),
  isLoading: false,
  transactions: [],
  error: null
};

// State management mini-library
const createStore = (initialState) => {
  let state = { ...initialState };
  const listeners = [];
  
  const getState = () => ({ ...state });
  
  const setState = (newState) => {
    state = { ...state, ...newState };
    listeners.forEach(listener => listener(state));
  };
  
  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  };
  
  return { getState, setState, subscribe };
};

// Create store instance
const store = createStore(state);

// Connect UI elements to store
store.subscribe((state) => {
  updateTransactionListUI(state.transactions, state.isLoading, state.error);
});

// Action creator
const fetchTransactions = async () => {
  store.setState({ isLoading: true, error: null });
  
  try {
    const response = await fetch(`/api/accounts/${store.getState().accountId}/transactions`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    
    const data = await response.json();
    store.setState({ 
      transactions: data.transactions,
      isLoading: false
    });
  } catch (error) {
    store.setState({ 
      error: error.message,
      isLoading: false
    });
  }
};
```

#### For Interactive Components

For more complex interactive components that require sophisticated state management:

- Use a lightweight state management library like Alpine.js or Stimulus
- Alternatively, implement module-based custom state management

```javascript
// Using Alpine.js for component state
// <div x-data="transactionFilters()">...</div>
window.transactionFilters = () => ({
  filters: {
    dateRange: 'last30days',
    categories: [],
    minAmount: null,
    maxAmount: null
  },
  showFilters: false,
  toggleFilters() {
    this.showFilters = !this.showFilters;
  },
  applyFilters() {
    // Logic to apply filters and refresh data
    this.$dispatch('filters-changed', this.filters);
  },
  resetFilters() {
    this.filters = {
      dateRange: 'last30days',
      categories: [],
      minAmount: null,
      maxAmount: null
    };
    this.applyFilters();
  }
});
```

### JSON State Transport

For pages requiring complex state updates:

- Use JSON responses for AJAX requests
- Implement partial page updates based on state changes
- Structure API responses consistently

```javascript
// Example API response format
{
  "status": "success",
  "data": {
    "transactions": [
      {
        "id": "txn_12345",
        "amount": 125.00,
        "currency": "USD",
        "description": "Vendor payment",
        "date": "2025-04-10T12:30:45Z",
        "status": "completed"
      }
      // More transactions
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 48,
      "itemsPerPage": 10
    }
  },
  "meta": {
    "lastUpdated": "2025-04-14T08:15:30Z",
    "refreshInterval": 60
  }
}
```

## 3. State Synchronization

### Server-Client Sync Strategy

1. **Optimistic Updates**: Update UI immediately, then confirm with server
2. **Conflict Resolution**: Handle server rejections gracefully
3. **Retry Mechanism**: Implement exponential backoff for failed requests
4. **Sync Status Indicators**: Show sync status (synced, syncing, error)

```javascript
// Example of optimistic update with rollback
const updateTransactionCategory = async (transactionId, newCategory) => {
  // Store original state for potential rollback
  const originalState = store.getState();
  const originalTransaction = originalState.transactions.find(t => t.id === transactionId);
  
  // Optimistically update UI
  const updatedTransactions = originalState.transactions.map(t => 
    t.id === transactionId ? { ...t, category: newCategory } : t
  );
  
  store.setState({ 
    transactions: updatedTransactions,
    syncStatus: 'syncing'
  });
  
  try {
    // Send update to server
    const response = await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ category: newCategory })
    });
    
    if (!response.ok) throw new Error('Failed to update transaction');
    
    // Update sync status on success
    store.setState({ syncStatus: 'synced' });
    
    // Show success notification
    showNotification('Transaction updated successfully', 'success');
    
  } catch (error) {
    // Rollback to original state
    store.setState({
      transactions: originalState.transactions,
      syncStatus: 'error',
      syncError: error.message
    });
    
    // Show error notification
    showNotification('Failed to update transaction: ' + error.message, 'error');
    
    // Retry logic
    if (shouldRetry(error)) {
      setTimeout(() => updateTransactionCategory(transactionId, newCategory), getRetryDelay());
    }
  }
};
```

### Real-time Updates

For features requiring real-time updates:

- Use WebSockets for critical real-time data (transaction alerts)
- Implement polling with appropriate intervals for less critical updates
- Batch updates to minimize server load

```javascript
// Example of WebSocket connection for real-time updates
const setupRealTimeUpdates = (accountId) => {
  const socket = new WebSocket(`wss://api.payymo.com/ws/accounts/${accountId}`);
  
  socket.addEventListener('open', (event) => {
    console.log('WebSocket connection established');
  });
  
  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'TRANSACTION_CREATED':
        handleNewTransaction(data.transaction);
        break;
      case 'TRANSACTION_UPDATED':
        handleUpdatedTransaction(data.transaction);
        break;
      case 'BALANCE_UPDATED':
        handleBalanceUpdate(data.balance);
        break;
      case 'CONNECTION_STATUS':
        handleConnectionStatus(data.status);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  });
  
  socket.addEventListener('close', (event) => {
    console.log('WebSocket connection closed');
    // Reconnect with exponential backoff
    setTimeout(() => setupRealTimeUpdates(accountId), getReconnectDelay());
  });
  
  socket.addEventListener('error', (event) => {
    console.error('WebSocket error:', event);
  });
  
  return socket;
};
```

## 4. Form State Management

### Form State Architecture

Form state in Payymo builds on our [Form Engine](./FORM_ENGINE.md) and follows these principles:

1. **Local State**: Form data stays in local state until submission
2. **Validation**: Client-side validation with server confirmation
3. **Draft Saving**: Automatic saving of form drafts
4. **Field Dependencies**: Clear handling of interdependent fields

```javascript
// Form state management example
const createFormState = (formId, initialValues = {}, validationSchema = null) => {
  let state = {
    values: { ...initialValues },
    touched: {},
    errors: {},
    isSubmitting: false,
    isValid: false,
    submitError: null,
    submitCount: 0
  };
  
  const listeners = [];
  
  const getState = () => ({ ...state });
  
  const setState = (newState) => {
    state = { ...state, ...newState };
    
    // Validate if validation schema is provided
    if (validationSchema && (newState.values || newState.touched)) {
      state.errors = validateForm(state.values, validationSchema);
      state.isValid = Object.keys(state.errors).length === 0;
    }
    
    listeners.forEach(listener => listener(state));
  };
  
  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  };
  
  // Get a specific field value
  const getFieldValue = (fieldName) => state.values[fieldName];
  
  // Set a specific field value
  const setFieldValue = (fieldName, value) => {
    setState({
      values: {
        ...state.values,
        [fieldName]: value
      }
    });
  };
  
  // Mark a field as touched (interacted with)
  const setFieldTouched = (fieldName, isTouched = true) => {
    setState({
      touched: {
        ...state.touched,
        [fieldName]: isTouched
      }
    });
  };
  
  // Check if a field has an error
  const hasError = (fieldName) => {
    return Boolean(state.errors[fieldName] && (state.touched[fieldName] || state.submitCount > 0));
  };
  
  // Get the error message for a field
  const getFieldError = (fieldName) => {
    return hasError(fieldName) ? state.errors[fieldName] : null;
  };
  
  // Handle form submission
  const submitForm = async (submitFn) => {
    // Mark all fields as touched
    const allTouched = Object.keys(state.values).reduce((touched, key) => {
      touched[key] = true;
      return touched;
    }, {});
    
    setState({
      touched: allTouched,
      isSubmitting: true,
      submitError: null,
      submitCount: state.submitCount + 1
    });
    
    // Validate before submission
    if (!state.isValid) {
      setState({ isSubmitting: false });
      return false;
    }
    
    try {
      const result = await submitFn(state.values);
      setState({ isSubmitting: false });
      return result;
    } catch (error) {
      setState({ 
        isSubmitting: false,
        submitError: error.message
      });
      return false;
    }
  };
  
  // Reset the form to initial values
  const resetForm = (newInitialValues = initialValues) => {
    setState({
      values: { ...newInitialValues },
      touched: {},
      errors: {},
      isSubmitting: false,
      submitError: null
    });
  };
  
  return {
    getState,
    subscribe,
    getFieldValue,
    setFieldValue,
    setFieldTouched,
    hasError,
    getFieldError,
    submitForm,
    resetForm
  };
};
```

### Draft Saving Integration

Integrate with the Form Engine's draft saving capability:

```javascript
// Creating a form with draft saving
const bankConnectionForm = createFormState('bank_connection_form', {
  bank_id: '',
  account_name: '',
  agreement: false
});

// Initialize autosave service
const autosaveService = new FormAutosaveService('bank_connection_form', 5000);

// Connect form state to autosave
bankConnectionForm.subscribe((state) => {
  // Only save if any values exist (not on initialization)
  if (Object.keys(state.values).some(key => state.values[key])) {
    autosaveService.saveFormDraft(state.values);
  }
});

// Load draft on initialization
(async () => {
  const savedDraft = await autosaveService.loadFormDraft();
  if (savedDraft) {
    // Show prompt to restore draft
    if (confirm('We found a saved draft. Would you like to restore it?')) {
      bankConnectionForm.resetForm(savedDraft);
    } else {
      // Clear the draft if user doesn't want to restore
      autosaveService.clearFormDraft();
    }
  }
})();
```

## 5. Authentication State

### Authentication Flow

Authentication state follows a secure pattern:

1. **Session Based**: Use HTTP-only cookies for session management
2. **State Reflection**: Client-side state reflects session status
3. **Permission Checking**: Client UI responds to permission changes

```javascript
// Authentication state management
const createAuthState = () => {
  // Initial state from server-rendered data
  let state = {
    isAuthenticated: document.body.dataset.isAuthenticated === 'true',
    user: JSON.parse(document.getElementById('user-data')?.dataset.user || 'null'),
    permissions: JSON.parse(document.getElementById('user-permissions')?.dataset.permissions || '[]'),
    lastChecked: new Date().toISOString()
  };
  
  const listeners = [];
  
  const getState = () => ({ ...state });
  
  const setState = (newState) => {
    state = { ...state, ...newState };
    listeners.forEach(listener => listener(state));
  };
  
  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  };
  
  // Check if user has permission
  const hasPermission = (permission) => {
    return state.permissions.includes(permission);
  };
  
  // Check if user can access a feature
  const canAccess = (feature) => {
    // Define permission requirements for features
    const featurePermissions = {
      'bank-connections': ['bank:read'],
      'bank-connections-create': ['bank:create'],
      'transactions': ['transactions:read'],
      'payments': ['payments:read'],
      'reporting': ['reports:read'],
      'admin': ['admin:access']
    };
    
    const requiredPermissions = featurePermissions[feature] || [];
    return requiredPermissions.every(hasPermission);
  };
  
  // Refresh auth state from server
  const refreshAuthState = async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (!response.ok) throw new Error('Failed to check auth status');
      
      const data = await response.json();
      setState({
        isAuthenticated: data.isAuthenticated,
        user: data.user,
        permissions: data.permissions,
        lastChecked: new Date().toISOString()
      });
      
      return data.isAuthenticated;
    } catch (error) {
      console.error('Auth refresh error:', error);
      return state.isAuthenticated;
    }
  };
  
  // Logout action
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setState({
        isAuthenticated: false,
        user: null,
        permissions: []
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  return {
    getState,
    subscribe,
    hasPermission,
    canAccess,
    refreshAuthState,
    logout
  };
};

// Create auth state instance
const authState = createAuthState();

// Update UI based on auth state
authState.subscribe((state) => {
  // Update user info in header
  const userInfoEl = document.getElementById('user-info');
  if (userInfoEl && state.user) {
    userInfoEl.textContent = state.user.name;
  }
  
  // Show/hide elements based on permissions
  document.querySelectorAll('[data-requires-permission]').forEach(el => {
    const permission = el.dataset.requiresPermission;
    el.style.display = authState.hasPermission(permission) ? '' : 'none';
  });
});

// Periodically check authentication status
setInterval(() => {
  authState.refreshAuthState();
}, 5 * 60 * 1000); // Check every 5 minutes
```

## 6. Performance Considerations

### Rendering Optimization

- **Selective Updates**: Update only the DOM elements affected by state changes
- **Batch Updates**: Group multiple state changes to minimize renders
- **Debounce & Throttle**: Limit frequency of state changes for user inputs

```javascript
// Utility for debouncing state changes
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Example of debounced search filter
const searchInput = document.getElementById('transaction-search');
const handleSearch = debounce((event) => {
  store.setState({ searchTerm: event.target.value });
  filterTransactions();
}, 300);

searchInput.addEventListener('input', handleSearch);
```

### Memory Management

- **Cleanup Subscriptions**: Unsubscribe from state changes when elements are removed
- **Data Pagination**: Load and maintain only necessary data in state
- **State Rehydration**: Clear and rebuild state when navigating between pages

```javascript
// Example of subscription cleanup
const setupTransactionList = () => {
  const unsubscribe = store.subscribe(updateTransactionListUI);
  
  // Return cleanup function
  return () => {
    unsubscribe();
    // Additional cleanup
  };
};

// Usage with page lifecycle
document.addEventListener('DOMContentLoaded', () => {
  const cleanup = setupTransactionList();
  
  // Clean up when leaving the page
  window.addEventListener('beforeunload', cleanup);
});
```

## 7. Testing State Management

### Unit Testing

Test state management logic with clear, focused tests:

```javascript
// Example Jest test for state management
describe('Transaction Store', () => {
  let store;
  
  beforeEach(() => {
    store = createStore({
      transactions: [],
      isLoading: false,
      error: null
    });
  });
  
  test('should update isLoading state', () => {
    store.setState({ isLoading: true });
    expect(store.getState().isLoading).toBe(true);
  });
  
  test('should add transactions', () => {
    const newTransactions = [
      { id: 'txn1', amount: 100 },
      { id: 'txn2', amount: 200 }
    ];
    
    store.setState({ transactions: newTransactions });
    expect(store.getState().transactions).toHaveLength(2);
    expect(store.getState().transactions[0].id).toBe('txn1');
  });
  
  test('should notify subscribers of state changes', () => {
    const mockListener = jest.fn();
    store.subscribe(mockListener);
    
    store.setState({ isLoading: true });
    expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
      isLoading: true
    }));
  });
});
```

### Integration Testing

Test how state management integrates with UI components:

```javascript
// Example integration test
describe('Transaction Filter Component', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="transaction-filters">
        <input id="search-input" type="text">
        <select id="date-filter">
          <option value="all">All Time</option>
          <option value="today">Today</option>
        </select>
        <button id="apply-filters">Apply</button>
      </div>
      <div id="transaction-list"></div>
    `;
    
    // Initialize components
    setupTransactionFilters();
  });
  
  test('should update transaction list when filters are applied', () => {
    // Mock transaction fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transactions: [{ id: 'txn1', description: 'Test Transaction' }] })
    });
    
    // Set filter values
    document.getElementById('search-input').value = 'Test';
    document.getElementById('date-filter').value = 'today';
    
    // Apply filters
    document.getElementById('apply-filters').click();
    
    // Verify fetch was called with correct params
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('search=Test&date=today')
    );
    
    // Wait for state update and UI refresh
    return new Promise(resolve => setTimeout(resolve, 0))
      .then(() => {
        const transactionList = document.getElementById('transaction-list');
        expect(transactionList.textContent).toContain('Test Transaction');
      });
  });
});
```

## 8. Implementation Checklist

- [ ] Set up core state management utilities (createStore)
- [ ] Implement form state management with validation
- [ ] Create authentication state handling
- [ ] Build real-time update infrastructure
- [ ] Set up optimistic updates for common actions
- [ ] Implement draft saving for forms
- [ ] Create permission-based UI management
- [ ] Set up state persistence where appropriate
- [ ] Write unit tests for state logic
- [ ] Create integration tests for state and UI interaction