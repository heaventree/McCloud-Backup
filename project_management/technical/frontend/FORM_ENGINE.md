# Form Engine Management for Payymo

This document outlines the standards and implementation guidelines for the form management system in Payymo. The form engine is responsible for creating, validating, and processing various forms throughout the application, including bank connections, payment configurations, and user settings.

## 1. Form Schema Architecture

### JSON Schema-Based Approach

Forms in Payymo are defined as JSON schemas that specify fields, validation rules, and conditional logic. This approach provides:

- **Flexibility**: Easy to modify without code changes
- **Versioning**: Track form changes over time
- **Consistency**: Uniform validation across frontend and backend

### Basic Schema Structure

```json
{
  "formId": "bank_connection_form",
  "version": "1.0.0",
  "title": "Connect Bank Account",
  "description": "Connect your bank account using Open Banking",
  "submitLabel": "Connect Account",
  "fields": [
    {
      "id": "bank_id",
      "type": "dropdown",
      "label": "Select Your Bank",
      "required": true,
      "options": [
        { "value": "barclays", "label": "Barclays" },
        { "value": "hsbc", "label": "HSBC" },
        { "value": "lloyds", "label": "Lloyds Banking Group" }
      ],
      "placeholder": "Choose your bank"
    },
    {
      "id": "account_name",
      "type": "text",
      "label": "Account Name",
      "required": true,
      "validationRules": {
        "minLength": 3,
        "maxLength": 100
      },
      "placeholder": "Enter a name for this account"
    },
    {
      "id": "agreement",
      "type": "checkbox",
      "label": "I authorize Payymo to access my account information and transaction data",
      "required": true,
      "errorMessage": "You must authorize access to continue"
    }
  ],
  "sections": [
    {
      "id": "bank_details",
      "title": "Bank Information",
      "description": "Select your bank and provide a name for this connection",
      "fields": ["bank_id", "account_name"]
    },
    {
      "id": "authorization",
      "title": "Authorization",
      "description": "Authorize Payymo to access your banking data",
      "fields": ["agreement"]
    }
  ]
}
```

### Field Types

The form engine supports the following field types:

| Field Type | Description | Additional Properties |
|------------|-------------|----------------------|
| `text` | Single-line text input | `minLength`, `maxLength`, `pattern` |
| `textarea` | Multi-line text input | `minLength`, `maxLength`, `rows` |
| `email` | Email input with validation | `domainValidation` |
| `password` | Password input with strength indicator | `strengthCheck`, `minStrength` |
| `number` | Numeric input | `min`, `max`, `step` |
| `dropdown` | Select/dropdown menu | `options`, `multiple`, `searchable` |
| `radio` | Radio button group | `options`, `layout` |
| `checkbox` | Single checkbox or group | `options` (for groups) |
| `date` | Date picker | `minDate`, `maxDate`, `format` |
| `time` | Time picker | `format`, `step` |
| `file` | File upload | `maxSize`, `accept`, `multiple` |
| `hidden` | Hidden input field | n/a |
| `addressBlock` | Composite address fields | `fields`, `countries` |
| `repeater` | Repeatable group of fields | `itemSchema`, `minItems`, `maxItems` |

### Composite and Custom Fields

For complex inputs, the form engine supports composite fields:

```json
{
  "id": "payment_details",
  "type": "addressBlock",
  "label": "Billing Address",
  "required": true,
  "fields": [
    { "id": "line1", "type": "text", "label": "Address Line 1" },
    { "id": "line2", "type": "text", "label": "Address Line 2", "required": false },
    { "id": "city", "type": "text", "label": "City" },
    { "id": "postCode", "type": "text", "label": "Post Code", "validationRules": { "pattern": "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$" } },
    { "id": "country", "type": "dropdown", "label": "Country", "options": [] }
  ]
}
```

## 2. Conditional Logic

### Rules-Based Visibility

Fields can be shown or hidden based on conditions:

```json
{
  "id": "other_bank_name",
  "type": "text",
  "label": "Bank Name",
  "conditionalLogic": {
    "action": "show",
    "conditions": [
      {
        "fieldId": "bank_id",
        "operator": "equals",
        "value": "other"
      }
    ]
  }
}
```

### Complex Conditions

Multiple conditions can be combined with logical operators:

```json
{
  "id": "international_details",
  "type": "section",
  "conditionalLogic": {
    "action": "show",
    "operator": "AND",
    "conditions": [
      {
        "fieldId": "payment_type",
        "operator": "equals",
        "value": "bank_transfer"
      },
      {
        "fieldId": "is_international",
        "operator": "equals",
        "value": true
      }
    ]
  },
  "fields": [
    { "id": "swift_code", "type": "text", "label": "SWIFT/BIC Code" },
    { "id": "iban", "type": "text", "label": "IBAN" }
  ]
}
```

### Supported Operators

The conditional logic engine supports these operators:

- `equals`: Field value equals specified value
- `notEquals`: Field value does not equal specified value
- `contains`: Field value contains specified value (for arrays/strings)
- `greaterThan`, `lessThan`: Numeric comparisons
- `empty`, `notEmpty`: Check if field has a value
- `matchPattern`: Match against regex pattern

## 3. Validation Framework

### Client-Side Validation

Client-side validation is implemented using a combination of HTML5 validation attributes and custom validation:

```javascript
// Form validation example
function validateField(field, value) {
  const rules = field.validationRules || {};
  const errors = [];
  
  // Required field check
  if (field.required && (value === undefined || value === null || value === '')) {
    errors.push(`${field.label} is required`);
    return errors;
  }
  
  // Text length validation
  if (rules.minLength && value.length < rules.minLength) {
    errors.push(`${field.label} must be at least ${rules.minLength} characters`);
  }
  
  if (rules.maxLength && value.length > rules.maxLength) {
    errors.push(`${field.label} cannot exceed ${rules.maxLength} characters`);
  }
  
  // Pattern validation
  if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
    errors.push(rules.patternError || `${field.label} format is invalid`);
  }
  
  // Email validation
  if (field.type === 'email' && value && !isValidEmail(value)) {
    errors.push(`Please enter a valid email address`);
  }
  
  // Custom field-specific validations
  if (field.type === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`${field.label} must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push(`${field.label} cannot exceed ${rules.max}`);
    }
  }
  
  return errors;
}
```

### Server-Side Validation

Server-side validation reuses the same schema to ensure consistency:

```python
# Server-side validation example
def validate_form_submission(form_schema, form_data):
    """Validate form data against its schema"""
    errors = {}
    
    # Iterate through required fields
    for field in form_schema.get('fields', []):
        field_id = field.get('id')
        field_value = form_data.get(field_id)
        field_errors = []
        
        # Skip validation if field is hidden by conditional logic
        if not is_field_visible(field, form_data):
            continue
            
        # Required field check
        if field.get('required', False) and (field_value is None or field_value == ''):
            field_errors.append(f"{field.get('label')} is required")
        
        # Field-specific validation
        if field_value is not None and field_value != '':
            validation_rules = field.get('validationRules', {})
            
            # String length validation
            if 'minLength' in validation_rules and len(str(field_value)) < validation_rules['minLength']:
                field_errors.append(f"Must be at least {validation_rules['minLength']} characters")
                
            if 'maxLength' in validation_rules and len(str(field_value)) > validation_rules['maxLength']:
                field_errors.append(f"Cannot exceed {validation_rules['maxLength']} characters")
            
            # Pattern validation
            if 'pattern' in validation_rules:
                import re
                if not re.match(validation_rules['pattern'], str(field_value)):
                    field_errors.append(validation_rules.get('patternError', 'Invalid format'))
            
            # Type-specific validation
            if field.get('type') == 'email' and not is_valid_email(field_value):
                field_errors.append("Invalid email address")
                
            if field.get('type') == 'number':
                try:
                    num_value = float(field_value)
                    if 'min' in validation_rules and num_value < validation_rules['min']:
                        field_errors.append(f"Must be at least {validation_rules['min']}")
                    if 'max' in validation_rules and num_value > validation_rules['max']:
                        field_errors.append(f"Cannot exceed {validation_rules['max']}")
                except (ValueError, TypeError):
                    field_errors.append("Must be a valid number")
        
        if field_errors:
            errors[field_id] = field_errors
    
    return errors
```

## 4. Form Rendering

### Component-Based Rendering

Forms are rendered using a component system that maps field types to appropriate UI components:

```javascript
// Form renderer component (simplified example)
function FormRenderer({ formSchema, formData, onChange, onSubmit }) {
  const renderField = (field) => {
    // Check conditional visibility
    if (!isFieldVisible(field, formData)) {
      return null;
    }
    
    const value = formData[field.id] || field.defaultValue || '';
    
    // Render the appropriate component based on field type
    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
        return (
          <TextField
            id={field.id}
            label={field.label}
            type={field.type}
            value={value}
            required={field.required}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            error={field.error}
            helpText={field.helpText}
          />
        );
        
      case 'dropdown':
        return (
          <SelectField
            id={field.id}
            label={field.label}
            options={field.options}
            value={value}
            required={field.required}
            placeholder={field.placeholder}
            onChange={(newValue) => onChange(field.id, newValue)}
            error={field.error}
            helpText={field.helpText}
          />
        );
        
      case 'checkbox':
        return (
          <CheckboxField
            id={field.id}
            label={field.label}
            checked={value === true}
            required={field.required}
            onChange={(e) => onChange(field.id, e.target.checked)}
            error={field.error}
            helpText={field.helpText}
          />
        );
        
      // Add cases for other field types
        
      default:
        console.warn(`Unsupported field type: ${field.type}`);
        return null;
    }
  };
  
  return (
    <form onSubmit={onSubmit}>
      <h2>{formSchema.title}</h2>
      {formSchema.description && <p>{formSchema.description}</p>}
      
      {formSchema.sections ? (
        // Render by sections if defined
        formSchema.sections.map(section => (
          <section key={section.id}>
            <h3>{section.title}</h3>
            {section.description && <p>{section.description}</p>}
            {section.fields.map(fieldId => {
              const field = formSchema.fields.find(f => f.id === fieldId);
              return field ? (
                <div key={field.id} className="form-field">
                  {renderField(field)}
                </div>
              ) : null;
            })}
          </section>
        ))
      ) : (
        // Otherwise render all fields sequentially
        formSchema.fields.map(field => (
          <div key={field.id} className="form-field">
            {renderField(field)}
          </div>
        ))
      )}
      
      <div className="form-actions">
        <button type="submit">{formSchema.submitLabel || 'Submit'}</button>
      </div>
    </form>
  );
}
```

## 5. Draft & Autosave System

### Client-Side Autosave

Implement form data persistence with IndexedDB:

```javascript
// Autosave service
class FormAutosaveService {
  constructor(formId, saveInterval = 5000) {
    this.formId = formId;
    this.saveInterval = saveInterval;
    this.autosaveTimer = null;
    this.db = null;
    
    this.initDatabase();
  }
  
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PayymoForms', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('formDrafts')) {
          db.createObjectStore('formDrafts', { keyPath: 'formId' });
        }
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error opening IndexedDB', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  startAutosave(getFormDataFn) {
    // Clear any existing timer
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }
    
    // Set up autosave interval
    this.autosaveTimer = setInterval(() => {
      const formData = getFormDataFn();
      this.saveFormDraft(formData);
    }, this.saveInterval);
    
    // Return stop function
    return () => {
      if (this.autosaveTimer) {
        clearInterval(this.autosaveTimer);
        this.autosaveTimer = null;
      }
    };
  }
  
  async saveFormDraft(formData) {
    if (!this.db) {
      await this.initDatabase();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['formDrafts'], 'readwrite');
      const store = transaction.objectStore('formDrafts');
      
      const draft = {
        formId: this.formId,
        data: formData,
        lastUpdated: new Date().toISOString()
      };
      
      const request = store.put(draft);
      
      request.onsuccess = () => {
        console.log(`Draft saved for form ${this.formId}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error saving form draft', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  async loadFormDraft() {
    if (!this.db) {
      await this.initDatabase();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['formDrafts'], 'readonly');
      const store = transaction.objectStore('formDrafts');
      const request = store.get(this.formId);
      
      request.onsuccess = (event) => {
        const draft = event.target.result;
        resolve(draft ? draft.data : null);
      };
      
      request.onerror = (event) => {
        console.error('Error loading form draft', event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  async clearFormDraft() {
    if (!this.db) {
      await this.initDatabase();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['formDrafts'], 'readwrite');
      const store = transaction.objectStore('formDrafts');
      const request = store.delete(this.formId);
      
      request.onsuccess = () => {
        console.log(`Draft cleared for form ${this.formId}`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error clearing form draft', event.target.error);
        reject(event.target.error);
      };
    });
  }
}
```

### Draft Recovery UI

Implement a user interface for draft recovery:

```javascript
function DraftRecoveryPrompt({ draft, onRestore, onDiscard }) {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };
  
  return (
    <div className="draft-recovery-prompt">
      <h3>Resume Your Work</h3>
      <p>
        We found a saved draft from {formatDate(draft.lastUpdated)}.
        Would you like to continue where you left off?
      </p>
      <div className="prompt-actions">
        <button 
          className="btn-primary" 
          onClick={onRestore}
        >
          Restore Draft
        </button>
        <button 
          className="btn-secondary" 
          onClick={onDiscard}
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}
```

## 6. Form Submissions

### Submission Storage

Form submissions are stored in the database with the following structure:

```sql
CREATE TABLE form_submissions (
    id SERIAL PRIMARY KEY,
    form_id VARCHAR(100) NOT NULL,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    schema_version VARCHAR(20) NOT NULL,
    submission_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Index for efficient querying
CREATE INDEX idx_form_submissions_tenant_form ON form_submissions(tenant_id, form_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
```

### Submission Process

```python
# Python backend code for form submission processing
def process_form_submission(form_id, form_data, user_id, tenant_id):
    """Process a form submission"""
    try:
        # Get the current form schema
        form_schema = get_form_schema(form_id)
        
        # Validate submission against schema
        validation_errors = validate_form_submission(form_schema, form_data)
        if validation_errors:
            return {
                "success": False,
                "errors": validation_errors
            }
        
        # Store the submission
        submission_id = store_form_submission(
            form_id=form_id,
            tenant_id=tenant_id,
            user_id=user_id,
            schema_version=form_schema.get('version', '1.0.0'),
            submission_data=form_data,
            status='pending'
        )
        
        # Process the submission based on form type
        if form_id == 'bank_connection_form':
            process_bank_connection(submission_id, form_data, tenant_id)
        elif form_id == 'stripe_connection_form':
            process_stripe_connection(submission_id, form_data, tenant_id)
        
        # Return success response
        return {
            "success": True,
            "submission_id": submission_id,
            "message": "Form submitted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error processing form submission: {str(e)}", exc_info=True)
        return {
            "success": False,
            "errors": {
                "_global": ["An unexpected error occurred. Please try again."]
            }
        }
```

## 7. Form Schema Versioning

### Version Control

Form schemas are versioned to track changes over time:

```python
def update_form_schema(form_id, new_schema, user_id):
    """Update a form schema with versioning"""
    # Get the current schema
    current_schema = get_form_schema(form_id)
    
    # Determine the new version
    if current_schema:
        current_version = current_schema.get('version', '1.0.0')
        version_parts = current_version.split('.')
        # Increment the patch version
        new_version = f"{version_parts[0]}.{version_parts[1]}.{int(version_parts[2]) + 1}"
    else:
        new_version = '1.0.0'
    
    # Set the version in the new schema
    new_schema['version'] = new_version
    
    # Store the schema history
    store_form_schema_version(
        form_id=form_id,
        schema=current_schema,
        version=current_version,
        created_by=user_id
    )
    
    # Update the current schema
    update_current_form_schema(
        form_id=form_id,
        schema=new_schema,
        version=new_version,
        updated_by=user_id
    )
    
    return new_schema
```

### Schema History

Schema history is stored to allow for reviewing changes and potentially reverting to previous versions:

```sql
CREATE TABLE form_schema_history (
    id SERIAL PRIMARY KEY,
    form_id VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    schema JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    description TEXT
);

CREATE INDEX idx_form_schema_history ON form_schema_history(form_id, version);
```

## 8. Accessibility Requirements

All form components must meet WCAG 2.2 AA standards as defined in the [Accessibility Standards](./ACCESSIBILITY.md). Specifically for forms:

### Keyboard Navigation

- All form elements must be keyboard accessible
- Focus order must follow a logical sequence
- Focus states must be clearly visible

### Screen Reader Support

- All form fields must have proper labels
- Error messages must be associated with their fields using `aria-describedby`
- Instructions must be programmatically associated with forms

### Form Markup Example

```html
<div class="form-field">
  <label for="bank_id" id="bank_id_label">Select Your Bank</label>
  <select 
    id="bank_id" 
    name="bank_id"
    aria-labelledby="bank_id_label"
    aria-describedby="bank_id_error bank_id_help"
    aria-required="true"
    aria-invalid="false"
  >
    <option value="">Choose your bank</option>
    <option value="barclays">Barclays</option>
    <option value="hsbc">HSBC</option>
    <option value="lloyds">Lloyds Banking Group</option>
  </select>
  <div id="bank_id_help" class="field-help">
    Select your bank from the list
  </div>
  <div id="bank_id_error" class="field-error" aria-live="polite"></div>
</div>

<fieldset>
  <legend>Account Authorization</legend>
  <div class="form-field checkbox">
    <input 
      type="checkbox" 
      id="agreement" 
      name="agreement"
      aria-describedby="agreement_error"
      required
    >
    <label for="agreement">
      I authorize Payymo to access my account information and transaction data
    </label>
    <div id="agreement_error" class="field-error" aria-live="polite"></div>
  </div>
</fieldset>
```

## 9. Form Management Interface

### Admin Form Builder

The form builder interface allows administrators to:

1. Create new form schemas
2. Edit existing form schemas
3. Preview forms before publishing
4. View submission statistics
5. Export form submissions
6. Manage form versions

### Form Builder Components

- Field type selector
- Field properties editor
- Drag-and-drop form layout
- Conditional logic builder
- Form preview
- Version comparison view

## 10. Implementation Checklist

- [ ] Implement JSON schema processing engine
- [ ] Create field rendering components for all supported field types
- [ ] Implement client-side validation library
- [ ] Build corresponding server-side validation
- [ ] Create form autosave and draft recovery system
- [ ] Implement form submission storage and processing
- [ ] Build form schema versioning system
- [ ] Ensure all form elements meet accessibility requirements
- [ ] Create form builder interface for administrators
- [ ] Implement form analytics and reporting