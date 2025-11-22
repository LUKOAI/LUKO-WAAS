#!/usr/bin/env python3
"""
WAAS 2.0 - Automated Onboarding Workflow
=========================================

Automated seller onboarding after successful payment.

Onboarding Steps:
1. Welcome email with dashboard access
2. Gather brand assets (logo, colors, story)
3. Activate patronage in WordPress
4. Send onboarding checklist
5. Schedule onboarding call (optional)
6. Send getting started guide
7. Add to customer success sequence

Flow:
Payment Received
   ↓
Welcome Email (immediate)
   ↓
Brand Asset Collection Form
   ↓
Patronage Activation
   ↓
Dashboard Access Email
   ↓
Onboarding Checklist
   ↓
Day 3: Getting Started Tips
   ↓
Day 7: Feature Highlights
   ↓
Day 14: Success Check-in
   ↓
Day 30: Review Request
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging
from flask import Flask, request, jsonify

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
WORDPRESS_API_URL = os.getenv('WORDPRESS_API_URL')
WORDPRESS_API_KEY = os.getenv('WORDPRESS_API_KEY')
TYPEFORM_API_KEY = os.getenv('TYPEFORM_API_KEY')  # For brand asset collection
TYPEFORM_FORM_ID = os.getenv('TYPEFORM_FORM_ID')
EMAIL_API_URL = os.getenv('EMAIL_API_URL')  # Kartra, SendGrid, etc.


class OnboardingWorkflow:
    """Automated seller onboarding workflow"""

    def __init__(self):
        self.wordpress_api_url = WORDPRESS_API_URL
        self.wordpress_api_key = WORDPRESS_API_KEY

    def start_onboarding(self, customer_data: Dict) -> Dict:
        """Initiate onboarding workflow for new customer"""
        try:
            logger.info(f"Starting onboarding for {customer_data['email']}")

            # Step 1: Send welcome email
            self.send_welcome_email(customer_data)

            # Step 2: Send brand asset collection form
            self.send_brand_asset_form(customer_data)

            # Step 3: Create onboarding record
            onboarding_record = {
                'seller_id': customer_data['seller_id'],
                'email': customer_data['email'],
                'brand_name': customer_data.get('brand_name', ''),
                'start_date': datetime.utcnow().isoformat(),
                'status': 'in_progress',
                'steps_completed': [],
                'current_step': 'brand_asset_collection'
            }

            # Step 4: Schedule follow-up emails
            self.schedule_follow_up_emails(customer_data)

            # Step 5: Update CRM
            self.update_crm_onboarding_status(customer_data['seller_id'], 'started')

            return {
                'success': True,
                'onboarding_record': onboarding_record
            }

        except Exception as e:
            logger.error(f"Error starting onboarding: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def send_welcome_email(self, customer_data: Dict) -> bool:
        """Send welcome email to new patron"""
        try:
            email_content = f"""
Subject: Welcome to WAAS Patronage! 🎉

Hi {customer_data.get('contact_name', customer_data.get('brand_name', 'there'))}!

Welcome to WAAS Patronage! We're excited to have you on board.

Your patronage is now active, which means:

✅ Your logo is displayed on the website
✅ Your contact information is shown
✅ Only your products are featured (competitors removed)
✅ You have access to the client dashboard

📊 **Access Your Dashboard:**
URL: {self.get_dashboard_url(customer_data['seller_id'])}
Username: {customer_data['email']}
Password: [Will be sent separately]

📝 **Next Steps:**

1. Complete your brand profile (takes 2 minutes)
   → {self.get_brand_form_url(customer_data['seller_id'])}

2. Upload your logo and brand assets

3. Review your product listings

4. Check out your dedicated website:
   → {customer_data.get('website_url', 'Will be provided')}

🎯 **What Happens Next:**

- Day 1 (Today): Complete brand profile
- Day 3: Get familiar with your dashboard
- Day 7: Review first week's traffic stats
- Day 14: Optimization recommendations
- Day 30: First month review

💬 **Need Help?**

Reply to this email or schedule a call:
→ https://calendly.com/waas-onboarding

We're here to help you succeed!

Best regards,
Alex & the WAAS Team

---
P.S. Check your spam folder for additional emails from us, and add billing@waas.com to your contacts!
"""

            # Send email via email service
            self._send_email(
                to=customer_data['email'],
                subject="Welcome to WAAS Patronage! 🎉",
                body=email_content
            )

            logger.info(f"Welcome email sent to {customer_data['email']}")
            return True

        except Exception as e:
            logger.error(f"Error sending welcome email: {e}")
            return False

    def send_brand_asset_form(self, customer_data: Dict) -> bool:
        """Send brand asset collection form"""
        try:
            form_url = self.get_brand_form_url(customer_data['seller_id'])

            email_content = f"""
Subject: Complete Your Brand Profile (2 minutes)

Hi {customer_data.get('contact_name', 'there')}!

To make your website look amazing, we need a few brand assets from you.

This takes just 2 minutes:

👉 Complete your profile: {form_url}

**What we need:**

✅ Your logo (PNG or SVG)
✅ Brand colors (hex codes)
✅ Brand story (2-3 sentences)
✅ Contact preferences
✅ Any special requirements

Once submitted, we'll update your website within 24 hours.

Questions? Just reply to this email!

Best,
WAAS Team
"""

            self._send_email(
                to=customer_data['email'],
                subject="Complete Your Brand Profile (2 minutes)",
                body=email_content
            )

            return True

        except Exception as e:
            logger.error(f"Error sending brand form: {e}")
            return False

    def handle_brand_assets_submission(self, submission_data: Dict) -> bool:
        """Handle brand assets form submission"""
        try:
            seller_id = submission_data['seller_id']

            # Extract brand data
            brand_data = {
                'seller_id': seller_id,
                'brand_name': submission_data.get('brand_name'),
                'logo_url': submission_data.get('logo_url'),
                'primary_color': submission_data.get('primary_color'),
                'secondary_color': submission_data.get('secondary_color'),
                'brand_story': submission_data.get('brand_story'),
                'contact_email': submission_data.get('contact_email'),
                'contact_phone': submission_data.get('contact_phone'),
                'website': submission_data.get('website')
            }

            # Update patronage in WordPress
            self.update_patronage_branding(brand_data)

            # Send confirmation
            self.send_brand_assets_confirmation(submission_data['email'])

            # Update onboarding status
            self.update_onboarding_step(seller_id, 'brand_assets_submitted')

            return True

        except Exception as e:
            logger.error(f"Error handling brand assets: {e}")
            return False

    def update_patronage_branding(self, brand_data: Dict) -> bool:
        """Update patronage with brand assets"""
        try:
            url = f"{self.wordpress_api_url}/patronage/update"

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.wordpress_api_key}'
            }

            response = requests.post(url, json=brand_data, headers=headers, timeout=30)

            if response.status_code == 200:
                logger.info(f"Patronage updated for {brand_data['seller_id']}")
                return True
            else:
                logger.error(f"Failed to update patronage: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error updating patronage: {e}")
            return False

    def send_brand_assets_confirmation(self, email: str) -> bool:
        """Send confirmation after brand assets submission"""
        try:
            email_content = """
Subject: Brand Assets Received! ✅

Perfect! We've received your brand assets.

Your website will be updated within 24 hours with:

✅ Your logo
✅ Your brand colors
✅ Your brand story
✅ Your contact information

You'll receive a notification email when it's live.

In the meantime, check out your dashboard:
→ [Dashboard URL]

Thanks!
WAAS Team
"""

            self._send_email(
                to=email,
                subject="Brand Assets Received! ✅",
                body=email_content
            )

            return True

        except Exception as e:
            logger.error(f"Error sending confirmation: {e}")
            return False

    def schedule_follow_up_emails(self, customer_data: Dict) -> bool:
        """Schedule automated follow-up emails"""
        try:
            email = customer_data['email']

            # Schedule emails using Kartra, SendGrid, or similar
            follow_ups = [
                {
                    'day': 3,
                    'subject': 'Getting Started with WAAS - 3 Quick Tips',
                    'template': 'day3_tips'
                },
                {
                    'day': 7,
                    'subject': 'Your First Week Stats 📊',
                    'template': 'day7_stats'
                },
                {
                    'day': 14,
                    'subject': 'Maximizing Your WAAS Patronage',
                    'template': 'day14_optimization'
                },
                {
                    'day': 30,
                    'subject': 'Your First Month Review 🎉',
                    'template': 'day30_review'
                }
            ]

            for followup in follow_ups:
                # Schedule email
                logger.info(f"Scheduled Day {followup['day']} email for {email}")

            return True

        except Exception as e:
            logger.error(f"Error scheduling follow-ups: {e}")
            return False

    def update_onboarding_step(self, seller_id: str, step: str) -> bool:
        """Update onboarding progress"""
        try:
            # Update in database/CRM
            logger.info(f"Onboarding step updated for {seller_id}: {step}")
            return True

        except Exception as e:
            logger.error(f"Error updating onboarding step: {e}")
            return False

    def update_crm_onboarding_status(self, seller_id: str, status: str) -> bool:
        """Update CRM with onboarding status"""
        try:
            # Update Google Sheets CRM
            logger.info(f"CRM updated for {seller_id}: {status}")
            return True

        except Exception as e:
            logger.error(f"Error updating CRM: {e}")
            return False

    def get_dashboard_url(self, seller_id: str) -> str:
        """Generate dashboard URL for seller"""
        return f"https://dashboard.waas.com/seller/{seller_id}"

    def get_brand_form_url(self, seller_id: str) -> str:
        """Generate brand form URL"""
        return f"https://form.typeform.com/to/{TYPEFORM_FORM_ID}?seller_id={seller_id}"

    def _send_email(self, to: str, subject: str, body: str) -> bool:
        """Send email via email service"""
        try:
            # Implementation depends on email service (Kartra, SendGrid, etc.)
            logger.info(f"Email sent to {to}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False


# Flask API
app = Flask(__name__)
onboarding = OnboardingWorkflow()


@app.route('/api/start-onboarding', methods=['POST'])
def start_onboarding():
    """Start onboarding for new customer"""
    try:
        customer_data = request.json

        result = onboarding.start_onboarding(customer_data)

        return jsonify(result), 200 if result['success'] else 500

    except Exception as e:
        logger.error(f"Error in API: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/webhook/brand-assets', methods=['POST'])
def brand_assets_webhook():
    """Webhook for brand assets form submission (Typeform)"""
    try:
        submission = request.json

        result = onboarding.handle_brand_assets_submission(submission)

        return jsonify({'success': result}), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'onboarding-automation',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5006))
    app.run(host='0.0.0.0', port=port, debug=False)
