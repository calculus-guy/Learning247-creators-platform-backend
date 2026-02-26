const cron = require('node-cron');
const NotificationService = require('./notificationService');

/**
 * Email Scheduler Service
 * 
 * Manages cron jobs for automated email notifications:
 * - Session reminders (every 15 minutes)
 * - Other scheduled notifications
 */

class EmailSchedulerService {
  constructor() {
    this.notificationService = new NotificationService();
    this.jobs = {};
  }

  /**
   * Start session reminder cron job
   * Runs every 15 minutes to check for upcoming sessions
   */
  startSessionReminderJob() {
    // Run every 15 minutes
    const job = cron.schedule('*/15 * * * *', async () => {
      console.log('[Email Scheduler] Running session reminder job...');
      
      try {
        const result = await this.notificationService.processSessionReminders();
        console.log('[Email Scheduler] Session reminder job completed:', result);
      } catch (error) {
        console.error('[Email Scheduler] Session reminder job error:', error);
      }
    });

    this.jobs.sessionReminder = job;
    console.log('[Email Scheduler] Session reminder job started (runs every 15 minutes)');
  }

  /**
   * Start all scheduled jobs
   */
  startAll() {
    console.log('[Email Scheduler] Starting all scheduled jobs...');
    
    this.startSessionReminderJob();
    
    console.log('[Email Scheduler] All jobs started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    console.log('[Email Scheduler] Stopping all scheduled jobs...');
    
    Object.keys(this.jobs).forEach(jobName => {
      if (this.jobs[jobName]) {
        this.jobs[jobName].stop();
        console.log(`[Email Scheduler] Stopped job: ${jobName}`);
      }
    });

    this.jobs = {};
    console.log('[Email Scheduler] All jobs stopped');
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      notificationsEnabled: this.notificationService.isEnabled(),
      activeJobs: Object.keys(this.jobs),
      jobCount: Object.keys(this.jobs).length
    };
  }
}

// Export singleton instance
const emailSchedulerService = new EmailSchedulerService();
module.exports = emailSchedulerService;
