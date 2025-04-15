/**
 * API Route Validators
 * 
 * This module provides validation middleware for specific API routes,
 * ensuring input validation is consistently applied across all endpoints.
 */
import { z } from 'zod';
import { validate, validateId, validateNumericId } from '../utils/validation';
import { insertSiteSchema, insertStorageProviderSchema, insertBackupScheduleSchema, insertBackupSchema, insertFeedbackSchema } from '../../shared/schema';

// Site validators
export const validateCreateSite = validate(insertSiteSchema);
export const validateUpdateSite = validate(insertSiteSchema.partial());
export const validateSiteId = validateNumericId('id');
export const validateListSites = validate(
  z.object({
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0)
  }),
  { target: 'query' }
);

// Storage Provider validators
export const validateCreateStorageProvider = validate(insertStorageProviderSchema);
export const validateUpdateStorageProvider = validate(insertStorageProviderSchema.partial());
export const validateStorageProviderId = validateNumericId('id');
export const validateListStorageProviders = validate(
  z.object({
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0),
    type: z.string().optional()
  }),
  { target: 'query' }
);

// Backup Schedule validators
export const validateCreateBackupSchedule = validate(insertBackupScheduleSchema);
export const validateUpdateBackupSchedule = validate(insertBackupScheduleSchema.partial());
export const validateBackupScheduleId = validateNumericId('id');
export const validateListBackupSchedules = validate(
  z.object({
    siteId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0)
  }),
  { target: 'query' }
);

// Backup validators
export const validateCreateBackup = validate(insertBackupSchema);
export const validateUpdateBackup = validate(
  z.object({
    status: z.string().min(1).optional(),
    size: z.number().int().min(0).optional(),
    fileCount: z.number().int().min(0).optional(),
    changedFiles: z.number().int().min(0).optional(),
    error: z.string().optional()
  })
);
export const validateBackupId = validateNumericId('id');
export const validateListBackups = validate(
  z.object({
    siteId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0),
    status: z.string().optional()
  }),
  { target: 'query' }
);

// Backup Restoration validators
export const validateRestoreBackup = validate(
  z.object({
    backupId: z.number().int().positive(),
    targetPath: z.string().min(1),
    options: z.object({
      overwrite: z.boolean().optional().default(false),
      includeFiles: z.array(z.string()).optional(),
      excludeFiles: z.array(z.string()).optional()
    }).optional()
  })
);

// Feedback validators
export const validateCreateFeedback = validate(insertFeedbackSchema);
export const validateUpdateFeedback = validate(insertFeedbackSchema.partial());
export const validateFeedbackId = validateNumericId('id');
export const validateListFeedback = validate(
  z.object({
    projectId: z.string().optional(),
    pagePath: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    limit: z.coerce.number().int().positive().optional().default(100),
    offset: z.coerce.number().int().min(0).optional().default(0)
  }),
  { target: 'query' }
);

// Feedback Comment validators
export const validateCreateComment = validate(
  z.object({
    content: z.string().min(1),
    author: z.string().min(1).optional()
  })
);
export const validateCommentId = validateNumericId('id');

// GitHub validators
export const validateGitHubRepo = validate(
  z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    branch: z.string().optional().default('main'),
    path: z.string().optional().default('/')
  })
);

export const validateGitHubBackup = validate(
  z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    branch: z.string().optional().default('main'),
    path: z.string().optional().default('/'),
    message: z.string().optional().default('Backup from McCloud'),
    siteId: z.number().int().positive()
  })
);

// OAuth token validators
export const validateOAuthToken = validate(
  z.object({
    code: z.string().min(1),
    state: z.string().min(1)
  }),
  { target: 'query' }
);

export const validateOAuthRefresh = validate(
  z.object({
    provider: z.string().min(1)
  })
);

// User validators
export const validateLogin = validate(
  z.object({
    username: z.string().min(1),
    password: z.string().min(1)
  })
);

export const validateRegister = validate(
  z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(8).max(100),
    email: z.string().email().optional()
  })
);

// Health check validators
export const validateComponentHealth = validate(
  z.object({
    component: z.string().optional()
  }),
  { target: 'query' }
);