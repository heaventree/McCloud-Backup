import axios from 'axios';

// Define the base URL for the SVGL API
const SVGL_API_BASE_URL = 'https://svgl.app/api';

// Interface for SVGL icons
export interface SvglIcon {
  id: number;
  name: string;
  slug: string;
  svg: string;
}

/**
 * Fetch an SVG icon from the SVGL API by its slug
 * @param iconSlug The slug of the icon to fetch (e.g., 'google-drive', 'dropbox')
 * @returns The SVG markup as a string
 */
export async function fetchSvgIcon(iconSlug: string): Promise<string> {
  try {
    const response = await axios.get(`${SVGL_API_BASE_URL}/${iconSlug}`);
    return response.data.svg || '';
  } catch (error) {
    console.error(`Error fetching SVG icon ${iconSlug}:`, error);
    return ''; // Return empty string if icon couldn't be fetched
  }
}

/**
 * Map our storage provider types to SVGL icon slugs
 */
export const storageProviderToIconSlug: Record<string, string> = {
  'google-drive': 'google-drive',
  'dropbox': 'dropbox',
  'aws-s3': 'aws',
  'onedrive': 'onedrive',
  'local': 'folder',
  'ftp': 'server',
  'sftp': 'lock-shield', // Using a security-related icon for SFTP
  'webdav': 'globe',
};

/**
 * Get the appropriate icon slug based on the storage provider type
 * @param providerType The type of storage provider
 * @returns The corresponding SVGL icon slug
 */
export function getStorageProviderIconSlug(providerType: string): string {
  return storageProviderToIconSlug[providerType.toLowerCase()] || 'storage';
}

/**
 * Fetch an SVG icon for a specific storage provider
 * @param providerType The type of storage provider
 * @returns The SVG markup as a string
 */
export async function fetchStorageProviderIcon(providerType: string): Promise<string> {
  const iconSlug = getStorageProviderIconSlug(providerType);
  return fetchSvgIcon(iconSlug);
}