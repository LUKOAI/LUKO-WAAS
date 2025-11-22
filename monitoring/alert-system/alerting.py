#!/usr/bin/env python3
"""
WAAS 2.0 - Alert System
=======================

Send alerts via Email, Slack, SMS.
"""

import os
import logging
from typing import Dict
import smtplib
from email.mime.text import MIMEText
import requests

logger = logging.getLogger(__name__)

# Configuration
SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_FROM_NUMBER = os.getenv('TWILIO_FROM_NUMBER')
ALERT_EMAIL = os.getenv('ALERT_EMAIL', 'alerts@waas.com')
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASS = os.getenv('SMTP_PASS')


class AlertSystem:
    """Send alerts via multiple channels"""

    async def send_alert(self, alert: Dict):
        """Send alert via all configured channels"""
        try:
            urgency = alert.get('urgency', 'MEDIUM')
            message = alert.get('message', 'Alert')

            logger.info(f"Sending {urgency} alert: {message}")

            # Send via all channels
            await self.send_email_alert(alert)
            await self.send_slack_alert(alert)

            if urgency == 'URGENT':
                await self.send_sms_alert(alert)

        except Exception as e:
            logger.error(f"Error sending alert: {e}")

    async def send_email_alert(self, alert: Dict):
        """Send email alert"""
        try:
            subject = f"[{alert['urgency']}] WAAS Alert"
            body = f"{alert['message']}\n\nIncident: {alert.get('incident', {}).get('id', 'N/A')}"

            msg = MIMEText(body)
            msg['Subject'] = subject
            msg['From'] = SMTP_USER
            msg['To'] = ALERT_EMAIL

            with smtplib.SMTP(SMTP_HOST, 587) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)

            logger.info("Email alert sent")

        except Exception as e:
            logger.error(f"Error sending email: {e}")

    async def send_slack_alert(self, alert: Dict):
        """Send Slack alert"""
        try:
            if not SLACK_WEBHOOK_URL:
                return

            payload = {
                'text': f":warning: *{alert['urgency']} Alert*",
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': f"*{alert['message']}*"
                        }
                    }
                ]
            }

            requests.post(SLACK_WEBHOOK_URL, json=payload)
            logger.info("Slack alert sent")

        except Exception as e:
            logger.error(f"Error sending Slack alert: {e}")

    async def send_sms_alert(self, alert: Dict):
        """Send SMS alert (Twilio)"""
        try:
            if not TWILIO_ACCOUNT_SID:
                return

            from twilio.rest import Client

            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

            message = client.messages.create(
                body=f"WAAS URGENT: {alert['message']}",
                from_=TWILIO_FROM_NUMBER,
                to='+48123456789'  # On-call phone
            )

            logger.info("SMS alert sent")

        except Exception as e:
            logger.error(f"Error sending SMS: {e}")


if __name__ == '__main__':
    import asyncio

    alerter = AlertSystem()
    test_alert = {
        'urgency': 'URGENT',
        'message': 'Site down: example.com',
        'incident': {'id': 'INC-001'}
    }

    asyncio.run(alerter.send_alert(test_alert))
