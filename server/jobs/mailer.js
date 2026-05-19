/**
 * Mailer — Nodemailer Helper Functions
 *
 * Provides reusable email sending utilities. Configuration is read
 * from the database on every call so admin panel changes take effect
 * immediately without a server restart. Falls back to .env values if
 * no database config has been saved yet.
 *
 * Exports:
 *   getTransporter()          — builds a Nodemailer transporter from DB/env config
 *   getFromAddress()          — returns the formatted "From Name <address>" string
 *   sendVerificationEmail()   — sends the 8-digit account activation code
 *   sendPasswordResetEmail()  — sends the 8-digit password reset code
 *   testSmtpConnection()      — verifies SMTP credentials without sending
 *   sendTestEmail()           — sends a test message to confirm delivery works
 */
const nodemailer = require('nodemailer');
const { smtpQueries } = require('../db/database');

/**
 * Build a Nodemailer transporter using SMTP settings from the database,
 * falling back to environment variables if no DB config exists.
 */
function getTransporter() {
  const dbConfig = smtpQueries.get.get();
  const host = dbConfig?.host || process.env.SMTP_HOST;
  const port = dbConfig?.port || Number(process.env.SMTP_PORT) || 587;
  const user = dbConfig?.user || process.env.SMTP_USER;
  const pass = dbConfig?.pass || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // TLS on port 465, STARTTLS on 587
    auth: { user, pass },
  });
}

/**
 * Returns the formatted sender string, e.g. "FutureMail <noreply@futuremail.co.nz>"
 */
function getFromAddress() {
  const dbConfig = smtpQueries.get.get();
  const name    = dbConfig?.from_name    || process.env.MAIL_FROM_NAME    || 'FutureMail';
  const address = dbConfig?.from_address || process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER;
  return `"${name}" <${address}>`;
}

/**
 * Send an 8-digit verification code to a newly registered user.
 * The code expires after 30 minutes (enforced server-side).
 */
async function sendVerificationEmail(toEmail, toName, code) {
  const transporter = getTransporter();
  const from = getFromAddress();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Your FutureMail verification code',
    text: `Hi ${toName},\n\nYour verification code is: ${code}\n\nThis code expires in 30 minutes.\n\nIf you didn't create a FutureMail account, you can ignore this email.`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #FDFAF4;">
        <div style="border-left: 4px solid #8B2020; padding-left: 20px; margin-bottom: 30px;">
          <p style="color: #888; font-size: 13px; margin: 0 0 4px; font-family: sans-serif;">FutureMail</p>
          <h2 style="color: #2C1810; margin: 0; font-size: 22px;">Verify your account</h2>
        </div>
        <p style="color: #444; line-height: 1.7;">Hi ${toName},</p>
        <p style="color: #444; line-height: 1.7;">Enter this code to activate your FutureMail account:</p>
        <div style="background: #fff; border: 2px solid #E4CFA0; border-radius: 4px; padding: 24px; text-align: center; margin: 28px 0;">
          <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2C1810;">${code}</span>
        </div>
        <p style="color: #888; font-size: 13px; font-family: sans-serif;">This code expires in 30 minutes. If you didn't register, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E8DDD0; margin: 32px 0;" />
        <p style="color: #BBB; font-size: 11px; text-align: center; font-family: sans-serif;">FutureMail · Letters Across Time</p>
      </div>
    `,
  });
}

/**
 * Send an 8-digit password reset code to an existing active user.
 * The code expires after 30 minutes (enforced server-side).
 */
async function sendPasswordResetEmail(toEmail, toName, code) {
  const transporter = getTransporter();
  const from = getFromAddress();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'FutureMail — Password reset code',
    text: `Hi ${toName},\n\nYour password reset code is: ${code}\n\nThis code expires in 30 minutes.\n\nIf you didn't request a reset, you can safely ignore this email.`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #FDFAF4;">
        <div style="border-left: 4px solid #8B2020; padding-left: 20px; margin-bottom: 30px;">
          <p style="color: #888; font-size: 13px; margin: 0 0 4px; font-family: sans-serif;">FutureMail</p>
          <h2 style="color: #2C1810; margin: 0; font-size: 22px;">Reset your password</h2>
        </div>
        <p style="color: #444; line-height: 1.7;">Hi ${toName},</p>
        <p style="color: #444; line-height: 1.7;">Enter this code to reset your password:</p>
        <div style="background: #fff; border: 2px solid #E4CFA0; border-radius: 4px; padding: 24px; text-align: center; margin: 28px 0;">
          <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2C1810;">${code}</span>
        </div>
        <p style="color: #888; font-size: 13px; font-family: sans-serif;">This code expires in 30 minutes. If you didn't request a reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #E8DDD0; margin: 32px 0;" />
        <p style="color: #BBB; font-size: 11px; text-align: center; font-family: sans-serif;">FutureMail · Letters Across Time</p>
      </div>
    `,
  });
}

/**
 * Verify that SMTP credentials are valid by opening a connection.
 * Throws if the connection or authentication fails.
 * Used by the admin SMTP test endpoint (without sending a message).
 */
async function testSmtpConnection(config) {
  const transporter = nodemailer.createTransport({
    host:   config.host,
    port:   Number(config.port) || 587,
    secure: Number(config.port) === 465,
    auth:   { user: config.user, pass: config.pass },
  });
  await transporter.verify();
  return true;
}

/**
 * Send a test email to confirm end-to-end delivery is working.
 * Called from the admin SMTP settings panel when the admin
 * enters an optional "send test to" address.
 */
async function sendTestEmail(config, toEmail) {
  const transporter = nodemailer.createTransport({
    host:   config.host,
    port:   Number(config.port) || 587,
    secure: Number(config.port) === 465,
    auth:   { user: config.user, pass: config.pass },
  });
  const from = `"${config.from_name || 'FutureMail'}" <${config.from_address || config.user}>`;
  await transporter.sendMail({
    from,
    to:      toEmail,
    subject: 'FutureMail — SMTP test successful',
    text:    'This is a test email from your FutureMail instance. SMTP is configured correctly.',
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #FDFAF4;">
        <div style="border-left: 4px solid #2D7A2D; padding-left: 20px; margin-bottom: 24px;">
          <h2 style="color: #2C1810; margin: 0;">✅ SMTP test successful</h2>
        </div>
        <p style="color: #444; line-height: 1.7;">Your FutureMail email settings are configured correctly. Letters will be delivered as scheduled.</p>
        <hr style="border: none; border-top: 1px solid #E8DDD0; margin: 32px 0;" />
        <p style="color: #BBB; font-size: 11px; text-align: center; font-family: sans-serif;">FutureMail · Admin test</p>
      </div>
    `,
  });
}

module.exports = { getTransporter, getFromAddress, sendVerificationEmail, sendPasswordResetEmail, testSmtpConnection, sendTestEmail };
