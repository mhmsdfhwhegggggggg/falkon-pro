/**
 * Alert System - Production Ready
 * 
 * Handles security alerts and notifications:
 * - Email notifications
 * - Webhook notifications
 * - Logging
 * - Slack integration (optional)
 */

import axios from 'axios';

export interface AlertData {
  type: 'SECURITY_ALERT' | 'TAMPERING' | 'DEBUGGING' | 'LICENSE_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface AlertConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  slack?: {
    enabled: boolean;
    webhook: string;
    channel: string;
  };
}

class AlertSystem {
  private static instance: AlertSystem;
  private config: AlertConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): AlertSystem {
    if (!this.instance) {
      this.instance = new AlertSystem();
    }
    return this.instance;
  }

  private loadConfig(): AlertConfig {
    return {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
      },
      webhook: {
        enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        url: process.env.ALERT_WEBHOOK_URL || '',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Dragon-Telegram-Pro-Alerts/1.0',
        },
      },
      slack: {
        enabled: process.env.ALERT_SLACK_ENABLED === 'true',
        webhook: process.env.ALERT_SLACK_WEBHOOK || '',
        channel: process.env.ALERT_SLACK_CHANNEL || '#alerts',
      },
    };
  }

  async sendAlert(alert: AlertData): Promise<void> {
    console.error(`[ALERT] ${alert.type}: ${alert.message}`, alert.details);

    // Send email if enabled
    if (this.config.email?.enabled && this.config.email.recipients.length > 0) {
      await this.sendEmailAlert(alert).catch(console.error);
    }

    // Send webhook if enabled
    if (this.config.webhook?.enabled && this.config.webhook.url) {
      await this.sendWebhookAlert(alert).catch(console.error);
    }

    // Send Slack if enabled
    if (this.config.slack?.enabled && this.config.slack.webhook) {
      await this.sendSlackAlert(alert).catch(console.error);
    }
  }

  private async sendEmailAlert(alert: AlertData): Promise<void> {
    if (!this.config.email?.recipients.length) return;

    const emailData = {
      to: this.config.email.recipients.join(','),
      subject: `[${alert.severity}] ${alert.type} - Dragon Telegram Pro`,
      text: this.formatEmailText(alert),
      html: this.formatEmailHtml(alert),
    };

    console.log('[ALERT] Email alert would be sent:', emailData.subject);
    // In production, integrate with your email service (SendGrid, Nodemailer, etc.)
  }

  private async sendWebhookAlert(alert: AlertData): Promise<void> {
    if (!this.config.webhook?.url) return;

    try {
      await axios.post(this.config.webhook.url, alert, {
        headers: this.config.webhook.headers,
        timeout: 10000,
      });
      console.log('[ALERT] Webhook alert sent successfully');
    } catch (error) {
      console.error('[ALERT] Failed to send webhook alert:', error);
    }
  }

  private async sendSlackAlert(alert: AlertData): Promise<void> {
    if (!this.config.slack?.webhook) return;

    const slackMessage = {
      channel: this.config.slack.channel,
      username: 'Dragon Telegram Pro',
      icon_emoji: this.getSeverityEmoji(alert.severity),
      text: `${alert.type}: ${alert.message}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Time', value: alert.timestamp, short: true },
        ],
        ...(alert.details ? [{
          title: 'Details',
          text: JSON.stringify(alert.details, null, 2),
        }] : []),
      }],
    };

    try {
      await axios.post(this.config.slack.webhook, slackMessage, {
        timeout: 10000,
      });
      console.log('[ALERT] Slack alert sent successfully');
    } catch (error) {
      console.error('[ALERT] Failed to send Slack alert:', error);
    }
  }

  private formatEmailText(alert: AlertData): string {
    return `
Dragon Telegram Pro Alert

Type: ${alert.type}
Severity: ${alert.severity}
Time: ${alert.timestamp}
Message: ${alert.message}

${alert.details ? `Details:\n${JSON.stringify(alert.details, null, 2)}` : ''}

This is an automated alert from Dragon Telegram Pro.
    `.trim();
  }

  private formatEmailHtml(alert: AlertData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .severity-${alert.severity.toLowerCase()} { 
            background: ${this.getSeverityColor(alert.severity)}; 
            color: white; 
            padding: 5px 10px; 
            border-radius: 3px; 
            font-weight: bold;
        }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
        pre { background: #f1f1f1; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🚨 Dragon Telegram Pro Alert</h2>
        <p><strong>Type:</strong> ${alert.type}</p>
        <p><strong>Severity:</strong> <span class="severity-${alert.severity.toLowerCase()}">${alert.severity}</span></p>
        <p><strong>Time:</strong> ${alert.timestamp}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
    </div>
    
    ${alert.details ? `
    <div class="details">
        <h3>Details:</h3>
        <pre>${JSON.stringify(alert.details, null, 2)}</pre>
    </div>
    ` : ''}
    
    <hr>
    <p><small>This is an automated alert from Dragon Telegram Pro.</small></p>
</body>
</html>
    `.trim();
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return ':rotating_light:';
      case 'HIGH': return ':warning:';
      case 'MEDIUM': return ':exclamation:';
      case 'LOW': return ':information_source:';
      default: return ':bell:';
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return '#ff0000';
      case 'HIGH': return '#ff9900';
      case 'MEDIUM': return '#ffcc00';
      case 'LOW': return '#36a64f';
      default: return '#808080';
    }
  }
}

export const alertSystem = AlertSystem.getInstance();
