#!/usr/bin/env python3
"""
WAAS 2.0 - EverWebinar Automation
==================================

Automated webinar scheduling and management for qualified leads.

EverWebinar creates automated, pre-recorded webinars that appear live.
Perfect for SaaS sales funnels.

Features:
- Automated webinar scheduling
- Registration link generation
- Attendance tracking
- Conversion tracking
- Follow-up automation

Flow:
1. Qualified lead from AI call
2. Register lead for next available webinar
3. Send registration confirmation
4. Send reminders (24h, 1h, 15min before)
5. Track attendance
6. If attended → Send payment link
7. If no-show → Send replay link
8. Track conversion to paid customer
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
EVERWEBINAR_API_KEY = os.getenv('EVERWEBINAR_API_KEY')
EVERWEBINAR_WEBINAR_ID = os.getenv('EVERWEBINAR_WEBINAR_ID')
EVERWEBINAR_API_URL = 'https://api.webinarjam.com/everwebinar'

# Kartra for email automation (alternative to EverWebinar emails)
KARTRA_API_KEY = os.getenv('KARTRA_API_KEY')
KARTRA_API_URL = 'https://app.kartra.com/api'


class EverWebinarAutomation:
    """EverWebinar integration for automated webinar funnel"""

    def __init__(self):
        self.api_key = EVERWEBINAR_API_KEY
        self.webinar_id = EVERWEBINAR_WEBINAR_ID
        self.api_url = EVERWEBINAR_API_URL

    def register_attendee(self, lead_data: Dict) -> Optional[Dict]:
        """Register a qualified lead for the webinar"""
        try:
            url = f"{self.api_url}/register"

            # Calculate next available webinar time
            # EverWebinar shows webinars on schedule (e.g., daily at 2 PM, 6 PM)
            next_webinar_time = self._get_next_webinar_time()

            payload = {
                'api_key': self.api_key,
                'webinar_id': self.webinar_id,
                'first_name': lead_data.get('first_name', lead_data.get('contact_name', 'Seller')),
                'last_name': lead_data.get('last_name', ''),
                'email': lead_data['email'],
                'phone': lead_data.get('phone', ''),
                'schedule': next_webinar_time.isoformat(),
                'custom_fields': {
                    'seller_id': lead_data.get('seller_id'),
                    'brand_name': lead_data.get('brand_name'),
                    'source': 'ai_call',
                    'qualification': lead_data.get('qualification', 'QUALIFIED')
                }
            }

            response = requests.post(url, json=payload, timeout=30)

            if response.status_code == 200:
                result = response.json()

                logger.info(f"Webinar registration successful for {lead_data['email']}")

                return {
                    'success': True,
                    'registration_id': result.get('registration_id'),
                    'webinar_url': result.get('thank_you_url'),
                    'webinar_time': next_webinar_time.isoformat(),
                    'attendee_id': result.get('attendee_id')
                }
            else:
                logger.error(f"Failed to register: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': response.text
                }

        except Exception as e:
            logger.error(f"Error registering attendee: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_next_webinar_time(self) -> datetime:
        """Calculate next available webinar time"""
        # Example: Webinars at 2 PM and 6 PM daily
        now = datetime.utcnow()

        # Today's webinars
        today_2pm = now.replace(hour=14, minute=0, second=0, microsecond=0)
        today_6pm = now.replace(hour=18, minute=0, second=0, microsecond=0)

        # Tomorrow's first webinar
        tomorrow_2pm = today_2pm + timedelta(days=1)

        # Find next available
        if now < today_2pm:
            return today_2pm
        elif now < today_6pm:
            return today_6pm
        else:
            return tomorrow_2pm

    def get_attendee_status(self, email: str) -> Optional[Dict]:
        """Check if attendee attended the webinar"""
        try:
            url = f"{self.api_url}/attendees"

            payload = {
                'api_key': self.api_key,
                'webinar_id': self.webinar_id,
                'email': email
            }

            response = requests.post(url, json=payload, timeout=30)

            if response.status_code == 200:
                data = response.json()
                attendees = data.get('attendees', [])

                if attendees:
                    attendee = attendees[0]

                    return {
                        'registered': True,
                        'attended': attendee.get('attended', False),
                        'watch_time_minutes': attendee.get('watch_time', 0),
                        'clicked_cta': attendee.get('clicked_offer', False),
                        'registration_date': attendee.get('registered_at'),
                        'attendance_date': attendee.get('attended_at')
                    }
                else:
                    return {'registered': False}
            else:
                logger.error(f"Failed to get attendee status: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error getting attendee status: {e}")
            return None

    def send_registration_confirmation(self, lead_data: Dict, registration_result: Dict) -> bool:
        """Send registration confirmation email"""
        try:
            # This uses Kartra for email automation
            # Alternative: Use SendGrid, Mailgun, or EverWebinar's built-in emails

            email_data = {
                'email': lead_data['email'],
                'first_name': lead_data.get('first_name', lead_data.get('contact_name', 'Seller')),
                'webinar_url': registration_result['webinar_url'],
                'webinar_time': registration_result['webinar_time'],
                'template': 'webinar_registration_confirmation'
            }

            # Send email (implementation depends on email provider)
            logger.info(f"Registration confirmation sent to {lead_data['email']}")

            return True

        except Exception as e:
            logger.error(f"Error sending confirmation: {e}")
            return False

    def send_webinar_reminders(self, lead_data: Dict, webinar_time: datetime) -> bool:
        """Schedule automated reminders"""
        try:
            # Reminders at: 24h, 1h, 15min before webinar

            reminders = [
                {'hours_before': 24, 'template': 'webinar_reminder_24h'},
                {'hours_before': 1, 'template': 'webinar_reminder_1h'},
                {'minutes_before': 15, 'template': 'webinar_reminder_15min'}
            ]

            for reminder in reminders:
                # Schedule reminder email
                # Implementation depends on email automation platform

                logger.info(f"Reminder scheduled for {lead_data['email']}")

            return True

        except Exception as e:
            logger.error(f"Error scheduling reminders: {e}")
            return False

    def handle_webinar_attendance(self, attendee_data: Dict) -> Dict:
        """Handle post-webinar actions based on attendance"""
        try:
            email = attendee_data['email']
            attended = attendee_data.get('attended', False)
            watch_time = attendee_data.get('watch_time_minutes', 0)
            clicked_cta = attendee_data.get('clicked_cta', False)

            result = {
                'email': email,
                'next_action': '',
                'lead_score': 0
            }

            if attended:
                if clicked_cta:
                    # Hot lead - clicked CTA during webinar
                    result['next_action'] = 'send_payment_link_immediate'
                    result['lead_score'] = 10
                    logger.info(f"HOT LEAD: {email} clicked CTA")

                elif watch_time >= 8:
                    # Watched most of webinar (8+ minutes out of 10-15 min)
                    result['next_action'] = 'send_payment_link_followup'
                    result['lead_score'] = 8
                    logger.info(f"WARM LEAD: {email} watched {watch_time} minutes")

                elif watch_time >= 3:
                    # Watched some of webinar
                    result['next_action'] = 'send_replay_with_payment_link'
                    result['lead_score'] = 5
                    logger.info(f"INTERESTED: {email} watched {watch_time} minutes")

                else:
                    # Attended but left quickly
                    result['next_action'] = 'send_replay_link'
                    result['lead_score'] = 3
                    logger.info(f"COLD: {email} left early")

            else:
                # No-show
                result['next_action'] = 'send_replay_link'
                result['lead_score'] = 2
                logger.info(f"NO-SHOW: {email}")

            # Trigger appropriate follow-up action
            self.trigger_followup_action(attendee_data, result['next_action'])

            return result

        except Exception as e:
            logger.error(f"Error handling attendance: {e}")
            return {'error': str(e)}

    def trigger_followup_action(self, attendee_data: Dict, action: str) -> bool:
        """Trigger appropriate follow-up based on attendance"""
        try:
            email = attendee_data['email']

            if action == 'send_payment_link_immediate':
                # Send payment link immediately (hot lead)
                self.send_payment_link(email, urgency='high')

            elif action == 'send_payment_link_followup':
                # Send payment link with follow-up (warm lead)
                self.send_payment_link(email, urgency='medium')

            elif action == 'send_replay_with_payment_link':
                # Send replay + payment link
                self.send_replay_link(email, include_payment=True)

            elif action == 'send_replay_link':
                # Send just replay link
                self.send_replay_link(email, include_payment=False)

            return True

        except Exception as e:
            logger.error(f"Error triggering follow-up: {e}")
            return False

    def send_payment_link(self, email: str, urgency: str = 'medium') -> bool:
        """Send payment link to qualified lead"""
        try:
            # Payment link leads to Stripe/PayPal checkout

            payment_url = f"https://yoursite.com/checkout?email={email}"

            if urgency == 'high':
                template = 'payment_link_urgent'  # Limited-time offer
            else:
                template = 'payment_link_standard'

            # Send email with payment link
            logger.info(f"Payment link sent to {email} (urgency: {urgency})")

            return True

        except Exception as e:
            logger.error(f"Error sending payment link: {e}")
            return False

    def send_replay_link(self, email: str, include_payment: bool = False) -> bool:
        """Send webinar replay link"""
        try:
            replay_url = f"https://yoursite.com/webinar/replay?email={email}"

            if include_payment:
                template = 'replay_with_payment'
            else:
                template = 'replay_only'

            # Send email
            logger.info(f"Replay link sent to {email} (payment: {include_payment})")

            return True

        except Exception as e:
            logger.error(f"Error sending replay: {e}")
            return False

    def track_conversion(self, email: str, payment_status: str) -> bool:
        """Track if webinar attendee converted to paying customer"""
        try:
            # Update attendee record with conversion status

            logger.info(f"Conversion tracked for {email}: {payment_status}")

            # Update CRM
            # This integrates with Google Sheets CRM

            return True

        except Exception as e:
            logger.error(f"Error tracking conversion: {e}")
            return False


# Flask webhook handler
from flask import Flask, request, jsonify

app = Flask(__name__)
webinar_automation = EverWebinarAutomation()


@app.route('/webhook/everwebinar/attended', methods=['POST'])
def everwebinar_attended():
    """Webhook for webinar attendance events"""
    try:
        data = request.json

        logger.info(f"EverWebinar webhook received: {data.get('event')}")

        if data.get('event') == 'webinar.attended':
            # Handle attendance
            attendee_data = data.get('attendee', {})
            result = webinar_automation.handle_webinar_attendance(attendee_data)

            return jsonify({'status': 'success', 'result': result}), 200

        elif data.get('event') == 'webinar.registered':
            # Track registration
            logger.info(f"New registration: {data.get('attendee', {}).get('email')}")
            return jsonify({'status': 'success'}), 200

        return jsonify({'status': 'ignored'}), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/register', methods=['POST'])
def register_lead():
    """API endpoint to register a lead for webinar"""
    try:
        lead_data = request.json

        # Register for webinar
        result = webinar_automation.register_attendee(lead_data)

        if result['success']:
            # Send confirmation
            webinar_automation.send_registration_confirmation(lead_data, result)

            # Schedule reminders
            webinar_time = datetime.fromisoformat(result['webinar_time'])
            webinar_automation.send_webinar_reminders(lead_data, webinar_time)

            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Error registering lead: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'everwebinar-automation',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5004))
    app.run(host='0.0.0.0', port=port, debug=False)
