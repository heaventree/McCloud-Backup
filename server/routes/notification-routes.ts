/**
 * Notification Routes
 * 
 * API routes for notification management
 */
import { Router } from 'express';
import { notificationService } from '../services/notification-service';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/notifications - Get all notifications
 */
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const unreadOnly = req.query.unreadOnly === 'true';
    const category = req.query.category as string;
    const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : undefined;

    const result = await notificationService.getNotifications({
      limit,
      offset,
      unreadOnly,
      category,
      siteId,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count - Get unread notification count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount();
    res.json({ count });
  } catch (error) {
    logger.error('Error getting unread notification count:', error);
    res.status(500).json({ error: 'Failed to get unread notification count' });
  }
});

/**
 * PUT /api/notifications/:id/read - Mark notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const success = await notificationService.markAsRead(notificationId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/mark-all-read - Mark all notifications as read
 */
router.put('/mark-all-read', async (req, res) => {
  try {
    const success = await notificationService.markAllAsRead();
    res.json({ success });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /api/notifications/:id - Delete notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const success = await notificationService.deleteNotification(notificationId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications - Clear all notifications
 */
router.delete('/', async (req, res) => {
  try {
    const success = await notificationService.clearAllNotifications();
    res.json({ success });
  } catch (error) {
    logger.error('Error clearing all notifications:', error);
    res.status(500).json({ error: 'Failed to clear all notifications' });
  }
});

export default router;