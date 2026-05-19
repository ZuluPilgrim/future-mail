/**
 * Email Delivery Scheduler
 *
 * Runs two cron jobs:
 *
 *  1. Every 5 minutes — checks for letters whose send_at has passed and
 *     sends them via SMTP. On success the letter is marked sent=1. On
 *     failure it is left untouched and retried next cycle.
 *
 *  2. Every 10 minutes — deletes unverified user accounts whose
 *     verification code has expired (30-minute window).
 *
 * Email configuration is read from the database on every cycle so
 * changes made in the admin panel take effect without a restart.
 */
const cron = require('node-cron');
const { letterQueries, userQueries } = require('../db/database');
const { getTransporter, getFromAddress } = require('./mailer');

/**
 * Fetch all letters due for delivery, send each one, and mark as sent.
 * Only sends letters belonging to active (verified) users.
 */
async function sendDueLetters() {
  const due = letterQueries.findDue.all();
  if (due.length === 0) return;

  console.log(`[FutureMail] Processing ${due.length} letter(s)...`);
  const transporter = getTransporter();
  const from        = getFromAddress();

  for (const letter of due) {
    try {
      const recipients = JSON.parse(letter.recipients);

      await transporter.sendMail({
        from,
        to:      recipients.join(', '),
        subject: letter.subject,
        // Plain-text fallback for email clients that don't render HTML
        text: letter.body,
        // Styled HTML version
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="border-left: 4px solid #8B6F47; padding-left: 20px; margin-bottom: 30px;">
              <p style="color: #888; font-size: 13px; margin: 0 0 4px;">A message from the past</p>
              <h2 style="color: #2C1810; margin: 0; font-size: 22px;">${letter.subject}</h2>
            </div>
            <div style="color: #333; line-height: 1.8; white-space: pre-wrap; font-size: 16px;">
${letter.body}
            </div>
            <hr style="border: none; border-top: 1px solid #E8DDD0; margin: 40px 0;" />
            <p style="color: #AAA; font-size: 12px; text-align: center;">
              Sent with FutureMail — your self-hosted time capsule
            </p>
          </div>
        `,
      });

      letterQueries.markSent.run(letter.id);
      console.log(`[FutureMail] ✅ Sent letter ID ${letter.id} to ${recipients.join(', ')}`);
    } catch (err) {
      // Log the error but don't mark as sent — it will be retried next cycle
      console.error(`[FutureMail] ❌ Failed to send letter ID ${letter.id}:`, err.message);
    }
  }
}

/**
 * Remove pending (unverified) user accounts whose verification window
 * has expired. Admin accounts are never auto-deleted.
 */
function cleanupExpiredAccounts() {
  const result = userQueries.deleteExpiredPending.run();
  if (result.changes > 0) {
    console.log(`[FutureMail] 🧹 Removed ${result.changes} expired unverified account(s)`);
  }
}

/**
 * Start both cron jobs. Called once at server startup.
 */
function startEmailScheduler() {
  console.log('[FutureMail] Email scheduler starting...');

  // Send due letters every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    sendDueLetters().catch(err => console.error('[FutureMail] Scheduler error:', err));
  });

  // Clean up expired pending accounts every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    cleanupExpiredAccounts();
  });

  // Run both immediately on startup to catch anything missed while offline
  sendDueLetters().catch(err => console.error('[FutureMail] Initial send error:', err));
  cleanupExpiredAccounts();

  console.log('[FutureMail] ✅ Scheduler active (letters: every 5min, cleanup: every 10min).');
}

module.exports = { startEmailScheduler };
