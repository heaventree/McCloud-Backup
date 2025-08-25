/**
 * Common Notification Service
 * 
 * Centralized service for sending notifications through various channels.
 * Supports email notifications via Gmail SMTP and is extensible for future
 * notification types like in-app/browser notifications via WebSockets.
 */

import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { notificationService } from './notification-service';
import prisma from '../prisma';

// Notification types
export type NotificationType = 'email' | 'inapp' | 'sms' | 'push';

// Notification data structure
export interface NotificationData {
  userId?: number;
  siteId?: number;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  category: 'backup' | 'token_refresh' | 'site_settings' | 'system';
  data?: Record<string, any>;
}

// Email-specific configuration
export interface EmailNotificationConfig {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export class CommonNotificationService {
  private static instance: CommonNotificationService;
  private emailTransporter: nodemailer.Transporter | null = null;

  public static getInstance(): CommonNotificationService {
    if (!CommonNotificationService.instance) {
      CommonNotificationService.instance = new CommonNotificationService();
    }
    return CommonNotificationService.instance;
  }

  constructor() {
    this.initializeEmailService();
  }

  /**
   * Initialize Gmail SMTP email service
   */
  private initializeEmailService() {
    try {
      const gmailEmail = process.env.GMAIL_EMAIL;
      const gmailPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailEmail || !gmailPassword) {
        logger.warn('Gmail credentials not found. Email notifications will be disabled.', {
          hasEmail: !!gmailEmail,
          hasPassword: !!gmailPassword
        });
        return;
      }

      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailEmail,
          pass: gmailPassword
        }
      });

      // Verify the connection
      this.emailTransporter?.verify((error, success) => {
        if (error) {
          logger.error('Failed to initialize Gmail SMTP service:', error);
          this.emailTransporter = null;
        } else {
          logger.info('Gmail SMTP service initialized successfully');
        }
      });
    } catch (error) {
      logger.error('Error initializing Gmail SMTP service:', error);
      this.emailTransporter = null;
    }
  }

  /**
   * Single entry point for sending notifications
   * Handles routing to appropriate notification channels based on user preferences
   */
  async sendNotification(
    notificationData: NotificationData,
    channels: NotificationType[] = ['inapp']
  ): Promise<{
    success: boolean;
    results: { [key in NotificationType]?: boolean };
    errors?: string[];
  }> {
    const results: { [key in NotificationType]?: boolean } = {};
    const errors: string[] = [];

    try {
      // Always create an in-app notification record
      const inAppResult = await this.sendInAppNotification(notificationData);
      results.inapp = inAppResult;

      // Process other notification channels
      for (const channel of channels) {
        if (channel === 'inapp') continue; // Already handled above

        switch (channel) {
          case 'email':
            const emailResult = await this.sendEmailNotification(notificationData);
            results.email = emailResult.success;
            if (!emailResult.success && emailResult.error) {
              errors.push(`Email: ${emailResult.error}`);
            }
            break;
          
          case 'sms':
            // Future implementation for SMS notifications
            results.sms = false;
            errors.push('SMS notifications not implemented yet');
            break;
          
          case 'push':
            // Future implementation for push notifications
            results.push = false;
            errors.push('Push notifications not implemented yet');
            break;
        }
      }

      const overallSuccess = Object.values(results).some(result => result === true);

      return {
        success: overallSuccess,
        results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error('Error in sendNotification:', error);
      return {
        success: false,
        results: {},
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Send in-app notification (stored in database)
   */
  private async sendInAppNotification(data: NotificationData): Promise<boolean> {
    try {
      const notification = await notificationService.createNotification({
        title: data.title,
        message: data.message,
        type: data.type,
        category: data.category,
        siteId: data.siteId,
        read: false,
        data: data.data ? JSON.stringify(data.data) : undefined
      });

      return notification !== null;
    } catch (error) {
      logger.error('Failed to create in-app notification:', error);
      return false;
    }
  }

  /**
   * Send email notification via Gmail SMTP
   */
  private async sendEmailNotification(
    data: NotificationData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.emailTransporter) {
        return {
          success: false,
          error: 'Email service not initialized'
        };
      }

      // Get user's email preferences if userId is provided
      let recipientEmail: string | null = null;
      let shouldSendEmail = false;

      if (data.userId) {
        const preferences = await prisma.notificationPreferences.findUnique({
          where: { userId: data.userId }
        });

        if (preferences && preferences.emailEnabled && preferences.emailAddress) {
          recipientEmail = preferences.emailAddress;
          
          // Check if this type of notification is enabled for email
          shouldSendEmail = this.shouldSendEmailForCategory(data.category, data.type, preferences);
        }
      }

      if (!recipientEmail || !shouldSendEmail) {
        return {
          success: false,
          error: 'Email notifications not enabled for this user or event type'
        };
      }

      // Generate email content
      const emailConfig = this.generateEmailContent(data);
      
      const mailOptions = {
        from: process.env.GMAIL_EMAIL,
        to: recipientEmail,
        subject: emailConfig.subject,
        text: emailConfig.text,
        html: emailConfig.html
      };

      await this.emailTransporter.sendMail(mailOptions);

      logger.info('Email notification sent successfully', {
        to: recipientEmail,
        subject: emailConfig.subject,
        category: data.category,
        type: data.type
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to send email notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if email should be sent for this category and type based on user preferences
   */
  private shouldSendEmailForCategory(
    category: string,
    type: string,
    preferences: any
  ): boolean {
    switch (category) {
      case 'backup':
        if (type === 'success') {
          return preferences.emailBackupCompleted;
        } else if (type === 'error') {
          return preferences.emailBackupFailed;
        }
        return true; // Default to sending for other backup notifications
      
      case 'system':
        if (type === 'warning') {
          return preferences.emailStorageWarning;
        }
        return true; // Default to sending for other system notifications
      
      default:
        return true; // Default to sending for unknown categories
    }
  }

  /**
   * Generate email content based on notification data
   */
  private generateEmailContent(data: NotificationData): EmailNotificationConfig {
    const baseSubject = this.getSubjectPrefix(data.type);
    
    const subject = `${baseSubject} ${data.title}`;
    
    const text = `
${data.title}

${data.message}

${data.data ? `Details: ${JSON.stringify(data.data, null, 2)}` : ''}

---
This is an automated notification from your backup system.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${this.getColorForType(data.type)}; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .details { background: #e9e9e9; padding: 10px; border-radius: 3px; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>${data.title}</h2>
        </div>
        <div class="content">
            <p>${data.message.replace(/\n/g, '<br>')}</p>
            ${data.data ? `
            <div class="details">
                <strong>Additional Details:</strong><br>
                <pre>${JSON.stringify(data.data, null, 2)}</pre>
            </div>
            ` : ''}
        </div>
        <div class="footer">
            This is an automated notification from your backup system.
        </div>
    </div>
</body>
</html>
    `.trim();

    return {
      to: '', // Will be set by the caller
      subject,
      text,
      html
    };
  }

  /**
   * Get email subject prefix based on notification type
   */
  private getSubjectPrefix(type: string): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📧';
    }
  }

  /**
   * Get color for notification type (for email styling)
   */
  private getColorForType(type: string): string {
    switch (type) {
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  }

  /**
   * Convenience method: Send backup completion notification
   */
  async sendBackupCompletionNotification(
    userId: number,
    siteId: number,
    siteName: string,
    backupDetails?: Record<string, any>
  ): Promise<void> {
    await this.sendNotification(
      {
        userId,
        siteId,
        title: 'Backup Completed Successfully',
        message: `Your backup for ${siteName} has been completed successfully.`,
        type: 'success',
        category: 'backup',
        data: backupDetails
      },
      ['inapp', 'email']
    );
  }

  /**
   * Convenience method: Send backup failure notification
   */
  async sendBackupFailureNotification(
    userId: number,
    siteId: number,
    siteName: string,
    error: string,
    backupDetails?: Record<string, any>
  ): Promise<void> {
    await this.sendNotification(
      {
        userId,
        siteId,
        title: 'Backup Failed',
        message: `Your backup for ${siteName} failed: ${error}`,
        type: 'error',
        category: 'backup',
        data: { error, ...backupDetails }
      },
      ['inapp', 'email']
    );
  }

  /**
   * Future: Send WebSocket notification for real-time in-app notifications
   * This method will be implemented when WebSocket support is added
   */
  private async sendWebSocketNotification(data: NotificationData): Promise<boolean> {
    // TODO: Implement WebSocket notifications for real-time in-app updates
    // This will integrate with the WebSocket server to send notifications
    // to connected clients in real-time
    logger.info('WebSocket notifications not implemented yet');
    return false;
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.emailTransporter) {
        return {
          success: false,
          error: 'Email service not initialized'
        };
      }

      await this.emailTransporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const commonNotificationService = CommonNotificationService.getInstance();