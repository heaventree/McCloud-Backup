import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { Backup, Site, StorageProvider } from '../../shared/schema';

interface BackupHistoryData {
  backups: Backup[];
  sites: Site[];
  storageProviders: StorageProvider[];
}

export class PDFService {
  /**
   * Generate a PDF report of backup history
   * @param data - Backup history data including backups, sites, and storage providers
   * @returns Buffer containing the PDF content
   */
  static async generateBackupHistoryPDF(data: BackupHistoryData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          info: {
            Title: 'Backup History Report',
            Author: 'Backup Management System',
            Subject: 'Detailed backup history report',
            Keywords: 'backup, history, report, wordpress'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Helper functions
        const getSite = (siteId: number): Site | undefined => {
          return data.sites.find(site => site.id === siteId);
        };

        const getStorageProvider = (providerId: number): StorageProvider | undefined => {
          return data.storageProviders.find(provider => provider.id === providerId);
        };

        const formatSize = (bytes: number | null): string => {
          if (bytes === null || bytes === undefined) return "--";
          const units = ["B", "KB", "MB", "GB", "TB"];
          let size = bytes;
          let unitIndex = 0;
          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }
          return `${size.toFixed(2)} ${units[unitIndex]}`;
        };

        const getStatusColor = (status: string): string => {
          switch (status) {
            case 'completed': return '#22c55e';
            case 'failed': return '#ef4444';
            case 'in_progress': return '#3b82f6';
            case 'pending': return '#f59e0b';
            default: return '#6b7280';
          }
        };

        // Header
        doc.fontSize(24).text('Backup History Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy at h:mm a')}`, { align: 'center' });
        doc.moveDown(1);

        // Summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);

        const totalBackups = data.backups.length;
        const completedBackups = data.backups.filter(b => b.status === 'completed').length;
        const failedBackups = data.backups.filter(b => b.status === 'failed').length;
        const inProgressBackups = data.backups.filter(b => b.status === 'in_progress').length;
        
        const totalSize = data.backups.reduce((sum, backup) => sum + (backup.filesize || 0), 0);

        doc.fontSize(12);
        doc.text(`Total Backups: ${totalBackups}`);
        doc.text(`Completed: ${completedBackups}`);
        doc.text(`Failed: ${failedBackups}`);
        doc.text(`In Progress: ${inProgressBackups}`);
        doc.text(`Total Size: ${formatSize(totalSize)}`);
        doc.moveDown(1);

        // Sites section
        doc.fontSize(16).text('Sites Overview', { underline: true });
        doc.moveDown(0.5);

        data.sites.forEach((site, index) => {
          const siteBackups = data.backups.filter(b => b.siteId === site.id);
          doc.fontSize(12);
          doc.text(`${index + 1}. ${site.name}`, { continued: true });
          doc.text(` (${siteBackups.length} backups)`, { align: 'right' });
          doc.fontSize(10);
          doc.text(`   URL: ${site.url}`);
          doc.text(`   Last Backup: ${site.lastBackup ? format(new Date(site.lastBackup), 'MMM dd, yyyy') : 'Never'}`);
          doc.moveDown(0.3);
        });

        doc.moveDown(0.5);

        // Storage Providers section
        doc.fontSize(16).text('Storage Providers', { underline: true });
        doc.moveDown(0.5);

        data.storageProviders.forEach((provider, index) => {
          const providerBackups = data.backups.filter(b => b.storageProviderId === provider.id);
          doc.fontSize(12);
          doc.text(`${index + 1}. ${provider.name}`, { continued: true });
          doc.text(` (${providerBackups.length} backups)`, { align: 'right' });
          doc.fontSize(10);
          doc.text(`   Type: ${provider.type}`);
          doc.moveDown(0.3);
        });

        doc.moveDown(0.5);

        // Detailed backup list
        doc.fontSize(16).text('Detailed Backup History', { underline: true });
        doc.moveDown(0.5);

        // Sort backups by date (most recent first)
        const sortedBackups = [...data.backups].sort((a, b) => {
          const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return dateB - dateA;
        });

        sortedBackups.forEach((backup, index) => {
          const site = getSite(backup.siteId);
          const provider = backup.storageProviderId ? getStorageProvider(backup.storageProviderId) : null;

          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage();
          }

          // Backup entry
          doc.fontSize(12);
          doc.fillColor('#000000');
          doc.text(`${index + 1}. ${site?.name || 'Unknown Site'}`, { continued: true });
          
          // Status indicator
          doc.fillColor(getStatusColor(backup.status));
          doc.text(` [${backup.status.toUpperCase()}]`, { align: 'right' });
          
          doc.fillColor('#000000');
          doc.fontSize(10);
          doc.text(`   Site: ${site?.url || '--'}`);
          doc.text(`   Type: ${backup.backupType || 'full'}`);
          doc.text(`   Size: ${formatSize(backup.filesize)}`);
          doc.text(`   Storage: ${provider?.name || 'Unknown'} (${provider?.type || 'unknown'})`);
          doc.text(`   Started: ${backup.startedAt ? format(new Date(backup.startedAt), 'MMM dd, yyyy h:mm a') : '--'}`);
          doc.text(`   Completed: ${backup.completedAt ? format(new Date(backup.completedAt), 'MMM dd, yyyy h:mm a') : '--'}`);
          
          if (backup.error) {
            doc.fillColor('#ef4444');
            doc.text(`   Error: ${backup.error}`);
            doc.fillColor('#000000');
          }
          
          doc.moveDown(0.5);
        });

        // Footer
        doc.fontSize(8);
        doc.fillColor('#6b7280');
        doc.text('Generated by Backup Management System', 50, doc.page.height - 50, { 
          align: 'center',
          width: doc.page.width - 100
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate a minimal PDF report with basic backup statistics
   * @param data - Backup history data
   * @returns Buffer containing the PDF content
   */
  static async generateQuickReportPDF(data: BackupHistoryData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Quick Backup Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Generated: ${format(new Date(), 'MMM dd, yyyy h:mm a')}`, { align: 'center' });
        doc.moveDown(1);

        // Statistics
        const stats = {
          total: data.backups.length,
          completed: data.backups.filter(b => b.status === 'completed').length,
          failed: data.backups.filter(b => b.status === 'failed').length,
          totalSize: data.backups.reduce((sum, backup) => sum + (backup.filesize || 0), 0)
        };

        doc.fontSize(14);
        doc.text(`Total Backups: ${stats.total}`);
        doc.text(`Successful: ${stats.completed}`);
        doc.text(`Failed: ${stats.failed}`);
        doc.text(`Success Rate: ${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%`);
        doc.text(`Total Storage Used: ${this.formatSize(stats.totalSize)}`);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private static formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

export const pdfService = PDFService;