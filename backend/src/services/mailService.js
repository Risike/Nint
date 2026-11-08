import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

/** Lazy-initialized nodemailer transporter */
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (config.smtpHost === 'smtp.gmail.com' || !config.smtpHost) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
  } else {
    _transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
  }

  return _transporter;
}

/**
 * Send a password-reset email to the given address.
 * @param {string} toEmail - Recipient email address
 * @param {string} resetToken - Hex token stored in DB
 * @param {string} displayName - Recipient's display name (for personalisation)
 */
export async function sendPasswordResetEmail(toEmail, resetToken, displayName) {
  const resetUrl = `${config.appBaseUrl}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0d0d1a; color: #e2e2f0; border-radius: 12px; padding: 32px;">
      <h2 style="color: #00e5ff; margin-top: 0;">🎮 Nint — Reset Your Password</h2>
      <p>Hi <strong>${displayName}</strong>,</p>
      <p>We received a request to reset the password for your Nint account.</p>
      <p>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}"
           style="background: #00e5ff; color: #0d0d1a; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 1rem; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 0.85rem; color: #888;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size: 0.8rem; word-break: break-all; color: #aaa;">${resetUrl}</p>
      <hr style="border-color: #333; margin: 24px 0;" />
      <p style="font-size: 0.8rem; color: #666;">
        If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
      </p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from: config.smtpFrom,
    to: toEmail,
    subject: '🔑 Nint — Password Reset Request',
    html
  });

  console.log(`[MAIL] Password reset email sent to ${toEmail} — MessageId: ${info.messageId}`);
  return info;
}
