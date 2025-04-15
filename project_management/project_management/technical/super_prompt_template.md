# Super Prompt Template for Rapid Prototype Development

## Project Specification Template

Use this template to rapidly prototype applications using our proven development patterns and architecture.

```
# [PROJECT NAME] Development Specification

## Project Overview
[Provide a brief description of the project, its purpose, and key functionality]

## Technical Requirements

### Frontend
- Framework: [Flask with templates/Bootstrap or React/Next.js]
- UI Components: [Describe major UI components needed]
- User Authentication: [Yes/No, and specific requirements]
- Responsive Design: [Yes/No, and specific breakpoints]

### Backend
- Framework: [Flask/FastAPI/Express.js]
- Database: [PostgreSQL/MySQL/MongoDB]
- API Architecture: [REST/GraphQL]
- Authentication: [JWT/OAuth/Session]

### External Integrations
- [List third-party services and APIs to integrate]
- [Specify authentication methods for each]

### Deployment
- Hosting: [Replit/AWS/Heroku/Vercel]
- CI/CD: [GitHub Actions/Jenkins/None]
- Environment: [Development/Staging/Production]

## Project Structure
Follow our proven directory structure:

```
project_root/
├── main.py                       # Application entry point
├── flask_backend/                # Backend application code
│   ├── app.py                    # Flask app initialization
│   ├── routes.py                 # Main API routes
│   ├── models.py                 # Database models
│   ├── services/                 # Business logic services
│   ├── utils/                    # Helper utilities
│   ├── static/                   # Static assets
│   └── templates/                # HTML templates
├── scripts/                      # Utility scripts
├── docs/                         # Documentation
└── tests/                        # Test suite
```

## Development Approach

### Phase 1: Setup and Core Features
1. Initialize project structure and base files
2. Set up database models and schemas
3. Implement core API endpoints
4. Create base UI templates/components
5. Implement authentication system

### Phase 2: Feature Development
1. [List key features in priority order]
2. [Specify any feature dependencies]
3. [Note complexity estimates if applicable]

### Phase 3: Integration and Polish
1. Connect to external services and APIs
2. Implement error handling and validation
3. Add responsive design and UI polish
4. Optimize performance

### Phase 4: Testing and Deployment
1. Write unit and integration tests
2. Set up CI/CD pipeline
3. Deploy staging environment
4. Final testing and deployment

## Best Practices to Apply

1. Follow the API integration patterns from our development guide
2. Implement comprehensive error handling for all API calls
3. Use type checking for data validation
4. Apply responsive design principles
5. Maintain clear separation of concerns between layers
6. Document all API endpoints and components

## Additional Requirements
[Add any specific requirements or constraints not covered above]
```

## Development Prompts

### Initial Setup Prompt

```
Please create a [type of application] for [purpose]. The application should use Flask with PostgreSQL on the backend, and Bootstrap for the frontend.

Key features required:
1. [Feature 1]
2. [Feature 2]
3. [Feature 3]

The application should follow the directory structure and patterns from our development guide:
- Flask backend with routes, services, and utils organization
- Component-based template structure
- Service-based architecture for business logic
- Comprehensive error handling for API calls
- Type validation for all inputs

Please implement the initial project setup with the database models, core routes, and basic UI structure. Follow our error handling patterns for all API integration points.
```

### API Integration Prompt

```
Please implement the integration with [API name]. The integration should:

1. Use the OAuthService pattern for authentication
2. Implement proper error handling with retry logic
3. Include input validation before API calls
4. Cache responses when appropriate
5. Log all API interactions at appropriate levels

The API requires the following environment variables:
- API_KEY: For authentication
- API_URL: Base URL for the API

Use our standard API integration pattern with the ExternalAPIService class approach.
```

### Database Schema Prompt

```
Create the database models for the application using SQLAlchemy. The models should include:

1. [Model 1] with fields: [field list]
2. [Model 2] with fields: [field list]
3. [Model 3] with fields: [field list]

Relationships:
- [Model 1] has many [Model 2]
- [Model 2] belongs to [Model 1] and [Model 3]
- [Model 3] has one [Model 1]

Include proper indexes for performance optimization and implement the relationship methods on each model. Follow our standard model pattern with proper validation and type checking.
```

### Error Handling Prompt

```
Implement the error handling system for the application following our centralized error handler pattern. The system should:

1. Define custom exception classes for different error types
2. Implement a global error handler for API responses
3. Return standardized error responses with appropriate HTTP status codes
4. Log all errors with context information
5. Include recovery mechanisms for common error scenarios

Use the APIError base class approach with specialized exception types for different error categories.
```

### UI Implementation Prompt

```
Create the frontend templates for the application using our component-based architecture. The UI should include:

1. [Component 1] for [purpose]
2. [Component 2] for [purpose]
3. [Component 3] for [purpose]

Each component should:
- Be responsive using Bootstrap grid system
- Include appropriate error states
- Implement loading indicators
- Follow our JavaScript module pattern for any interactive elements

The components should be organized in the templates/components directory with proper inheritance from the base layout.
```

### Testing Prompt

```
Create tests for the application using pytest. The tests should cover:

1. Unit tests for the service layer
2. Integration tests for the API endpoints
3. Model tests for database interactions

Implement the test fixtures needed for:
- Database testing with an in-memory SQLite database
- API mocking with the responses library
- Authentication simulation

Follow our test directory structure and naming conventions.
```

## Common Challenges and Solutions

This section outlines common development challenges and the proven patterns we've developed to address them.

### Authentication Challenges

**Challenge**: Implementing secure, maintainable authentication system across the application.

**Solution**: Use our `auth.py` utility module with JWT authentication:
- Central token generation and validation
- Route decorators for protected endpoints
- Clear separation between authentication and business logic

### External API Reliability

**Challenge**: Handling external API failures, timeouts, and rate limits.

**Solution**: Implement our `ExternalAPIService` class with:
- Automatic retry logic with exponential backoff
- Circuit breaker pattern for failing services
- Comprehensive error handling with custom exception types
- Request and response logging

### Database Performance

**Challenge**: Optimizing database performance for scale.

**Solution**: Apply our database optimization patterns:
- Proper indexing strategy based on query patterns
- Bulk operations for large datasets
- Connection pooling configuration
- Query optimization with eager loading
- Strategic caching of frequent queries

### UI Responsiveness

**Challenge**: Creating responsive, performant UI components.

**Solution**: Follow our component architecture:
- Bootstrap-based responsive grid system
- Progressive enhancement approach
- Optimistic UI updates
- Lazy loading for heavy components
- Clear loading and error states

### Logging and Monitoring

**Challenge**: Implementing comprehensive logging for debugging and monitoring.

**Solution**: Use our centralized logging system:
- Structured logging with context information
- Log levels appropriate for different environments
- Request ID tracking across service boundaries
- Performance timing for critical operations

## API Response Standards

All API responses should follow our standardized format:

```json
// Success response
{
  "status": "success",
  "data": {
    // Response data goes here
  },
  "meta": {
    "page": 1,
    "total": 100,
    "limit": 20
  }
}

// Error response
{
  "status": "error",
  "error": {
    "code": "validation_error",
    "message": "Invalid input data",
    "details": {
      "field_name": "Error message for this field"
    }
  }
}
```

## Database Schema Patterns

Follow these patterns for consistent database schema design:

1. **Base Model Pattern**:
```python
class Base(DeclarativeBase):
    pass

class BaseModel(db.Model):
    """Base model with common fields"""
    __abstract__ = True
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @classmethod
    def get_by_id(cls, id):
        return cls.query.get(id)
```

2. **Relationship Patterns**:
```python
# One-to-many relationship
class Parent(BaseModel):
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    children = relationship("Child", back_populates="parent")

class Child(BaseModel):
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("parent.id"))
    parent = relationship("Parent", back_populates="children")
```

3. **Indexing Pattern**:
```python
class User(BaseModel):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    username = Column(String(50), nullable=False)
    
    __table_args__ = (
        Index("idx_user_email_username", "email", "username"),
    )
```

## Conclusion

This super prompt template captures our proven development patterns and best practices. Use it as a starting point for rapid prototype development, adapting the specific details to your project requirements while maintaining the architectural principles that ensure maintainable, performant applications.