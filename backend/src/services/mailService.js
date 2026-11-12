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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send an account email-verification code.
 * @param {string} toEmail - Recipient email address
 * @param {string} code - Six-digit verification code
 * @param {string} displayName - Recipient's display name (for personalisation)
 */
export async function sendVerificationEmail(toEmail, code, displayName) {
  if (config.isTest) {
    return { messageId: 'test-verification-email' };
  }

  if (!config.smtpUser || !config.smtpPass) {
    if (config.isProduction) {
      throw new Error('SMTP credentials are not configured');
    }
    // Local development without SMTP: the code is printed so the signup flow
    // can still be completed. Never do this in production.
    console.log(`[MAIL:DEV] Verification code for ${toEmail}: ${code}`);
    return { messageId: 'development-log' };
  }

  const safeName = escapeHtml(displayName);
  const safeCode = escapeHtml(code);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0d0d1a; color: #e2e2f0; border-radius: 12px; padding: 32px;">
      <h2 style="color: #00e5ff; margin-top: 0;">🎮 Nint — Verify Your Email</h2>
      <p>Hi <strong>${safeName}</strong>,</p>
      <p>Use the code below to finish creating your Nint account. This code is valid for <strong>15 minutes</strong>.</p>
      <div style="margin: 28px 0; text-align: center;">
        <div style="display: inline-block; letter-spacing: 0.35em; font-size: 2rem; font-weight: 800; color: #0d0d1a; background: #00e5ff; border-radius: 8px; padding: 14px 22px;">${safeCode}</div>
      </div>
      <p>If you didn't create a Nint account, you can safely ignore this email.</p>
      <hr style="border-color: #333; margin: 24px 0;" />
      <p style="font-size: 0.8rem; color: #666;">Nint — “Nint is not Tetris.”</p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from: config.smtpFrom,
    to: toEmail,
    subject: '🎮 Nint — Verify Your Email',
    html
  });

  console.log(`[MAIL] Verification email sent to ${toEmail} — MessageId: ${info.messageId}`);
  return info;
}

/**
 * Send a password-reset email to the given address.
 * @param {string} toEmail - Recipient email address
 * @param {string} resetToken - Hex token stored in DB
 * @param {string} displayName - Recipient's display name (for personalisation)
 */
export async function sendPasswordResetEmail(toEmail, resetToken, displayName) {
  const resetUrl = `${config.appBaseUrl}/reset-password?token=${resetToken}`;
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(resetUrl);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0d0d1a; color: #e2e2f0; border-radius: 12px; padding: 32px;">
      <h2 style="color: #00e5ff; margin-top: 0;">🎮 Nint — Reset Your Password</h2>
      <p>Hi <strong>${safeName}</strong>,</p>
      <p>We received a request to reset the password for your Nint account.</p>
      <p>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${safeUrl}"
           style="background: #00e5ff; color: #0d0d1a; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 1rem; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 0.85rem; color: #888;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size: 0.8rem; word-break: break-all; color: #aaa;">${safeUrl}</p>
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
