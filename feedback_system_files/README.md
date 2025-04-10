# Feedback System Files

This directory contains all the necessary files to implement a point-and-click visual feedback system similar to Atarim. It allows users to click on page elements and leave targeted feedback comments.

## Features

- Interactive element selection with real-time highlighting
- Element path tracking to identify the exact component being commented on
- Coordinates recording for precise feedback positioning
- Comment system with threading
- Dashboard for managing feedback
- Embeddable standalone script for third-party sites

## Directory Structure

```
feedback_system_files/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── feedback/
│   │   │       └── FeedbackWidget.tsx     # React component for the feedback widget
│   │   ├── pages/
│   │   │   └── feedback.tsx               # Dashboard page for managing feedback
│   │   ├── utils/
│   │   │   └── type-utils.ts              # Utility functions for type safety
│   │   ├── lib/
│   │   │   └── types.ts                   # TypeScript type definitions
│   │   ├── hooks/
│   │   ├── embeddable/
│   │   │   └── feedback-script.ts         # Standalone script for embedding
│   └── ...
├── shared/
│   └── schema.ts                          # Database schema with Drizzle ORM
├── server/
│   ├── storage.ts                         # Storage implementation for database access
│   └── routes.ts                          # API routes for feedback functionality
└── README.md                              # This file
```

## Installation

1. Copy all the files into their respective locations in your project.
2. Install the required dependencies:

```bash
npm install @tanstack/react-query date-fns zod drizzle-orm drizzle-zod
npm install @radix-ui/react-dialog @radix-ui/react-avatar @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-badge
```

3. Set up the database tables by running the migrations with Drizzle.

## Integration Guide

### Frontend Integration

1. Import the `FeedbackWidget` component in your main layout or pages:

```tsx
import FeedbackWidget from '@/components/feedback/FeedbackWidget';

// Then in your component render function:
<FeedbackWidget projectId="your-project-id" />
```

2. Add the feedback dashboard page to your routes:

```tsx
// In your routes file:
<Route path="/feedback" component={FeedbackPage} />

// And add a link in your navigation:
<Link to="/feedback">Feedback</Link>
```

### Backend Integration

1. Register the API routes in your Express server setup:

```typescript
// In your server setup file:
import { registerFeedbackRoutes } from './routes';
import { PostgresStorage } from './storage';

// Initialize storage
const storage = new PostgresStorage(process.env.DATABASE_URL!);

// Register routes
registerFeedbackRoutes(app, storage);
```

### Embedding in Third-Party Sites

1. Build the embeddable script:

```bash
npx tsc client/src/embeddable/feedback-script.ts --outDir dist
```

2. Host the script on your server, and include it in third-party sites:

```html
<script src="https://your-server.com/scripts/feedback-widget.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    new FeedbackWidget({
      apiUrl: 'https://your-server.com/api/external/feedbacks',
      projectId: 'client-project-id',
      position: 'bottom-right'
    });
  });
</script>
```

## Implementation Notes

- The element selection feature uses CSS selectors to identify clicked elements
- The feedback widget includes element highlighting during selection
- The system supports different priorities and statuses for feedback items
- The dashboard provides filtering and sorting capabilities
- Real-time updates are implemented with a 2-second polling interval

## Customization

- To change the appearance of the widget, modify the styles in `FeedbackWidget.tsx`
- To customize the dashboard, edit the `feedback.tsx` page
- For different database configurations, update the schema and storage implementation