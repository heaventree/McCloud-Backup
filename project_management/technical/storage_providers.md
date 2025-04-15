# Storage Provider Integration Guide

This document details the integration of multiple cloud storage providers into the McCloud Backup platform, including authentication, file operations, and provider-specific considerations.

## Supported Storage Providers

The McCloud Backup platform currently supports the following storage providers:

1. **Google Drive**
   - OAuth 2.0 authentication
   - Directory-based organization
   - Version history support

2. **Dropbox**
   - OAuth 2.0 authentication
   - Path-based file system
   - File chunking for large uploads

3. **Microsoft OneDrive**
   - OAuth 2.0 authentication
   - Graph API integration
   - User and Business account support

4. **Amazon S3**
   - API key authentication
   - Bucket-based storage
   - Lifecycle rules for backup retention

5. **GitHub** (In Development)
   - OAuth 2.0 authentication
   - Repository-based backup storage
   - Branch and tag management

## Authentication Framework

### OAuth 2.0 Implementation

Most cloud storage providers use OAuth 2.0 for authentication. The general flow is:

1. **Authorization Request** - Redirect user to provider's authorization page
2. **Authorization Grant** - User approves access, provider returns authorization code
3. **Token Exchange** - Exchange authorization code for access and refresh tokens
4. **Token Storage** - Securely store tokens in database
5. **Token Refresh** - Use refresh token to obtain new access token when expired

### Authentication Code Example

```typescript
// server/auth.ts
export async function initiateOAuth(provider: string, req: Request, res: Response) {
  const config = getOAuthConfig(provider);
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  
  const authUrl = new URL(config.authorizationUrl);
  authUrl.searchParams.append('client_id', config.clientId);
  authUrl.searchParams.append('redirect_uri', config.redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('scope', config.scopes.join(' '));
  
  res.redirect(authUrl.toString());
}

export async function handleOAuthCallback(provider: string, req: Request, res: Response) {
  try {
    const { code, state } = req.query;
    
    // Verify state to prevent CSRF
    if (state !== req.session.oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    const config = getOAuthConfig(provider);
    const tokenResponse = await axios.post(config.tokenUrl, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    });
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiry = new Date(Date.now() + expires_in * 1000).toISOString();
    
    // Store tokens in user's session and database
    req.session.oauthTokens = {
      ...req.session.oauthTokens,
      [provider]: { access_token, refresh_token, expires_in, token_type: 'Bearer' }
    };
    
    // Save provider to database
    await storage.createStorageProvider({
      userId: req.session.user.id,
      type: provider,
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
      config: {},
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiry: expiry,
      status: 'active'
    });
    
    res.redirect('/storage-providers?success=true');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/storage-providers?error=auth_failed');
  }
}
```

## Provider-Specific Implementation

### Google Drive

#### Authentication

- **Scope Requirements**: `https://www.googleapis.com/auth/drive.file`
- **API Base URL**: `https://www.googleapis.com/drive/v3`
- **Refresh Token Handling**: Long-lived refresh tokens, requires periodic renewal

#### File Operations

```typescript
// server/storage-providers/google-drive.ts
export class GoogleDriveProvider implements StorageProviderInterface {
  constructor(private config: StorageProviderConfig) {}
  
  async createFolder(name: string, parentId?: string): Promise<string> {
    const response = await axios.post(
      'https://www.googleapis.com/drive/v3/files',
      {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : 'root'
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.id;
  }
  
  async uploadFile(fileName: string, content: Buffer, folderId?: string): Promise<string> {
    // Implementation for uploading files to Google Drive
    // ...
  }
  
  // Additional methods...
}
```

### Dropbox

#### Authentication

- **Scope Requirements**: `files.content.write files.content.read`
- **API Base URL**: `https://api.dropboxapi.com/2`
- **Refresh Token Handling**: Uses long-lived refresh tokens

#### File Operations

```typescript
// server/storage-providers/dropbox.ts
export class DropboxProvider implements StorageProviderInterface {
  constructor(private config: StorageProviderConfig) {}
  
  async createFolder(path: string): Promise<string> {
    const response = await axios.post(
      'https://api.dropboxapi.com/2/files/create_folder_v2',
      { path },
      {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.metadata.id;
  }
  
  // Implementation for large file upload with chunking
  async uploadLargeFile(fileName: string, filePath: string, folderPath: string): Promise<string> {
    // Implementation for chunked upload to Dropbox
    // ...
  }
  
  // Additional methods...
}
```

### GitHub (In Development)

#### Authentication

- **Scope Requirements**: `repo` (for private repositories)
- **API Base URL**: `https://api.github.com`
- **Refresh Token Handling**: GitHub tokens don't expire by default

#### Repository Operations

```typescript
// server/storage-providers/github.ts
export class GitHubProvider implements StorageProviderInterface {
  constructor(private config: StorageProviderConfig) {}
  
  async createRepository(name: string, isPrivate: boolean = true): Promise<string> {
    const response = await axios.post(
      'https://api.github.com/user/repos',
      {
        name,
        private: isPrivate,
        description: 'WordPress backup repository created by McCloud Backup'
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    return response.data.name;
  }
  
  async createOrUpdateFile(repoName: string, path: string, content: string, message: string): Promise<void> {
    // Implementation for creating/updating files in GitHub repository
    // ...
  }
  
  // Additional methods for branch management, commits, etc.
}
```

## Storage Provider Interface

All storage providers implement a common interface to ensure consistent behavior:

```typescript
// server/storage-providers/provider-interface.ts
export interface StorageProviderInterface {
  // Authentication
  checkAuthentication(): Promise<boolean>;
  refreshToken(): Promise<boolean>;
  
  // Storage operations
  getAvailableSpace(): Promise<{ used: number; total: number; }>;
  
  // Folder operations
  createFolder(name: string, parentPath?: string): Promise<string>;
  listFolders(path?: string): Promise<Folder[]>;
  
  // File operations
  uploadFile(fileName: string, content: Buffer, folderPath?: string): Promise<string>;
  downloadFile(filePath: string): Promise<Buffer>;
  deleteFile(filePath: string): Promise<boolean>;
  
  // Backup-specific operations
  createBackupStructure(siteName: string, timestamp: string): Promise<BackupStructure>;
  finalizeBackup(backupId: string): Promise<boolean>;
}
```

## Provider Factory

A factory pattern is used to create the appropriate provider instance based on the provider type:

```typescript
// server/storage-providers/provider-factory.ts
export function createStorageProvider(providerConfig: StorageProvider): StorageProviderInterface {
  switch (providerConfig.type) {
    case 'google-drive':
      return new GoogleDriveProvider(providerConfig);
    case 'dropbox':
      return new DropboxProvider(providerConfig);
    case 'onedrive':
      return new OneDriveProvider(providerConfig);
    case 's3':
      return new S3Provider(providerConfig);
    case 'github':
      return new GitHubProvider(providerConfig);
    default:
      throw new Error(`Unsupported storage provider type: ${providerConfig.type}`);
  }
}
```

## Error Handling

Each provider implements specific error handling for its API:

```typescript
// server/storage-providers/error-handler.ts
export function handleProviderError(provider: string, error: any): StorageError {
  if (axios.isAxiosError(error)) {
    // Handle network or API errors
    if (error.response) {
      // The request was made and the server responded with an error status
      switch (provider) {
        case 'google-drive':
          return handleGoogleDriveError(error.response.data);
        case 'dropbox':
          return handleDropboxError(error.response.data);
        case 'github':
          return handleGitHubError(error.response.data);
        // Other providers...
      }
    } else if (error.request) {
      // The request was made but no response was received
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error, unable to connect to storage provider',
        retry: true
      };
    }
  }
  
  // Generic error handling
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown storage provider error',
    retry: false
  };
}
```

## Testing Storage Providers

Each storage provider includes tests for authentication and file operations:

```typescript
// tests/storage-providers/google-drive.test.ts
describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;
  
  beforeEach(() => {
    // Set up provider with mock credentials
    provider = new GoogleDriveProvider({
      id: 1,
      userId: 1,
      type: 'google-drive',
      name: 'Google Drive',
      config: {},
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      tokenExpiry: new Date(Date.now() + 3600 * 1000).toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Mock axios for API calls
    axios.post = jest.fn();
    axios.get = jest.fn();
  });
  
  test('createFolder should create a folder and return id', async () => {
    // Mock implementation
    (axios.post as jest.Mock).mockResolvedValue({
      data: { id: 'folder-123' }
    });
    
    const result = await provider.createFolder('Backup Folder');
    expect(result).toBe('folder-123');
    expect(axios.post).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files',
      expect.objectContaining({
        name: 'Backup Folder',
        mimeType: 'application/vnd.google-apps.folder'
      }),
      expect.any(Object)
    );
  });
  
  // Additional tests...
});
```

## GitHub Repository Structure (In Development)

The GitHub storage provider is designed to store WordPress backups in a structured repository:

```
repository-name/
├── backups/
│   ├── YYYY-MM-DD-HHMMSS/ (Timestamp folder for each backup)
│   │   ├── database.sql
│   │   ├── files.zip
│   │   └── manifest.json
│   └── latest/
│       ├── database.sql (Symlink or copy of latest backup)
│       ├── files.zip
│       └── manifest.json
├── logs/
│   └── backup-logs.json
└── README.md
```

The repository structure provides:
- Timestamp-based organization for easy navigation
- Manifest files with backup metadata
- Latest backup shortcuts for quick access
- Log files for tracking backup history

## Conclusion

The storage provider system is designed to be modular and extensible, allowing for easy addition of new providers. The common interface ensures consistent behavior across providers, while provider-specific implementations handle the unique requirements of each API.

---

*Last updated: April 15, 2025*