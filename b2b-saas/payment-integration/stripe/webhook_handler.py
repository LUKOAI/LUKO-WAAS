#!/usr/bin/env python3
"""
WAAS 2.0 - Stripe Webhook Handler
==================================

Handles Stripe payment webhooks and automatically activates patronage
when a seller subscribes.

Events handled:
- checkout.session.completed - One-time payment or subscription start
- invoice.payment_succeeded - Recurring subscription payment
- customer.subscription.deleted - Subscription cancelled
- customer.subscription.updated - Subscription plan changed

Flow:
1. Receive Stripe webhook
2. Verify webhook signature
3. Extract payment data
4. Call WordPress REST API to activate/deactivate patronage
5. Generate invoice
6. Send onboarding email
"""

import os
import json
import hmac
import hashlib
import requests
from datetime import datetime
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify
import stripe
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Load configuration from environment
STRIPE_API_KEY = os.getenv('STRIPE_API_KEY')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')
WORDPRESS_API_URL = os.getenv('WORDPRESS_API_URL')  # e.g., https://example.com/wp-json/waas/v1
WORDPRESS_API_KEY = os.getenv('WORDPRESS_API_KEY')

# Initialize Stripe
stripe.api_key = STRIPE_API_KEY


class StripeWebhookHandler:
    """Handles Stripe webhook events and triggers patronage activation"""

    def __init__(self):
        self.wordpress_api_url = WORDPRESS_API_URL
        self.wordpress_api_key = WORDPRESS_API_KEY

    def verify_signature(self, payload: bytes, sig_header: str) -> Optional[Dict]:
        """Verify Stripe webhook signature"""
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
            logger.info(f"Webhook signature verified: {event['type']}")
            return event
        except ValueError as e:
            logger.error(f"Invalid payload: {e}")
            return None
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e}")
            return None

    def extract_seller_data(self, event: Dict) -> Optional[Dict]:
        """Extract seller data from Stripe event metadata"""
        try:
            event_type = event['type']

            if event_type == 'checkout.session.completed':
                session = event['data']['object']
                metadata = session.get('metadata', {})
                customer_details = session.get('customer_details', {})

                return {
                    'seller_id': metadata.get('seller_id'),
                    'brand_name': metadata.get('brand_name'),
                    'logo_url': metadata.get('logo_url'),
                    'email': customer_details.get('email') or metadata.get('email'),
                    'phone': metadata.get('phone'),
                    'website': metadata.get('website'),
                    'brand_story': metadata.get('brand_story'),
                    'subscription_id': session.get('subscription'),
                    'customer_id': session.get('customer'),
                    'amount': session.get('amount_total', 0) / 100,  # Convert from cents
                    'currency': session.get('currency', 'eur'),
                    'payment_status': session.get('payment_status'),
                    'subscription_type': metadata.get('subscription_type', 'monthly'),  # monthly or yearly
                }

            elif event_type == 'invoice.payment_succeeded':
                invoice = event['data']['object']
                subscription_id = invoice.get('subscription')
                customer_id = invoice.get('customer')

                # Fetch subscription details
                if subscription_id:
                    subscription = stripe.Subscription.retrieve(subscription_id)
                    metadata = subscription.get('metadata', {})

                    return {
                        'seller_id': metadata.get('seller_id'),
                        'brand_name': metadata.get('brand_name'),
                        'subscription_id': subscription_id,
                        'customer_id': customer_id,
                        'amount': invoice.get('amount_paid', 0) / 100,
                        'currency': invoice.get('currency', 'eur'),
                        'payment_status': 'paid',
                        'invoice_id': invoice.get('id'),
                        'invoice_url': invoice.get('hosted_invoice_url'),
                    }

            elif event_type == 'customer.subscription.deleted':
                subscription = event['data']['object']
                metadata = subscription.get('metadata', {})

                return {
                    'seller_id': metadata.get('seller_id'),
                    'subscription_id': subscription.get('id'),
                    'status': 'cancelled',
                }

            elif event_type == 'customer.subscription.updated':
                subscription = event['data']['object']
                metadata = subscription.get('metadata', {})

                return {
                    'seller_id': metadata.get('seller_id'),
                    'subscription_id': subscription.get('id'),
                    'status': subscription.get('status'),
                    'cancel_at_period_end': subscription.get('cancel_at_period_end', False),
                }

            return None

        except Exception as e:
            logger.error(f"Error extracting seller data: {e}")
            return None

    def activate_patronage(self, seller_data: Dict) -> bool:
        """Call WordPress REST API to activate patronage"""
        try:
            url = f"{self.wordpress_api_url}/patronage/activate"

            payload = {
                'seller_id': seller_data['seller_id'],
                'brand_name': seller_data.get('brand_name', ''),
                'logo_url': seller_data.get('logo_url', ''),
                'email': seller_data.get('email', ''),
                'phone': seller_data.get('phone', ''),
                'website': seller_data.get('website', ''),
                'brand_story': seller_data.get('brand_story', ''),
                'features': {
                    'logo': True,
                    'contact': True,
                    'brand_story': True,
                    'exclusive_products': True,
                }
            }

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.wordpress_api_key}'
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 200:
                logger.info(f"Patronage activated for seller: {seller_data['seller_id']}")
                return True
            else:
                logger.error(f"Failed to activate patronage: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Error calling WordPress API: {e}")
            return False

    def deactivate_patronage(self, seller_id: str) -> bool:
        """Call WordPress REST API to deactivate patronage"""
        try:
            url = f"{self.wordpress_api_url}/patronage/deactivate"

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.wordpress_api_key}'
            }

            response = requests.post(url, headers=headers, timeout=30)

            if response.status_code == 200:
                logger.info(f"Patronage deactivated for seller: {seller_id}")
                return True
            else:
                logger.error(f"Failed to deactivate patronage: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Error calling WordPress API: {e}")
            return False

    def handle_event(self, event: Dict) -> Dict[str, Any]:
        """Main event handler"""
        event_type = event['type']
        logger.info(f"Processing event: {event_type}")

        seller_data = self.extract_seller_data(event)

        if not seller_data:
            logger.warning(f"No seller data extracted from event: {event_type}")
            return {'status': 'error', 'message': 'No seller data found'}

        # Handle different event types
        if event_type == 'checkout.session.completed':
            # New subscription started
            if seller_data.get('payment_status') == 'paid':
                success = self.activate_patronage(seller_data)
                if success:
                    # Trigger invoice generation
                    self.generate_invoice(seller_data)
                    # Trigger onboarding email
                    self.send_onboarding_email(seller_data)
                    return {'status': 'success', 'action': 'patronage_activated'}
                else:
                    return {'status': 'error', 'message': 'Failed to activate patronage'}

        elif event_type == 'invoice.payment_succeeded':
            # Recurring payment succeeded - ensure patronage is still active
            success = self.activate_patronage(seller_data)
            if success:
                self.generate_invoice(seller_data)
                return {'status': 'success', 'action': 'patronage_renewed'}
            else:
                return {'status': 'error', 'message': 'Failed to renew patronage'}

        elif event_type == 'customer.subscription.deleted':
            # Subscription cancelled - deactivate patronage
            success = self.deactivate_patronage(seller_data['seller_id'])
            if success:
                self.send_cancellation_email(seller_data)
                return {'status': 'success', 'action': 'patronage_deactivated'}
            else:
                return {'status': 'error', 'message': 'Failed to deactivate patronage'}

        elif event_type == 'customer.subscription.updated':
            # Subscription updated (e.g., set to cancel at period end)
            if seller_data.get('cancel_at_period_end'):
                logger.warning(f"Subscription will cancel at period end: {seller_data['seller_id']}")
                self.send_cancellation_warning_email(seller_data)
                return {'status': 'success', 'action': 'cancellation_scheduled'}
            else:
                return {'status': 'success', 'action': 'subscription_updated'}

        return {'status': 'ignored', 'message': f'Event type not handled: {event_type}'}

    def generate_invoice(self, seller_data: Dict) -> bool:
        """Trigger invoice generation"""
        try:
            # This will be implemented in the invoice-generator module
            logger.info(f"Invoice generation triggered for seller: {seller_data['seller_id']}")
            # Call invoice generator API or service here
            return True
        except Exception as e:
            logger.error(f"Error generating invoice: {e}")
            return False

    def send_onboarding_email(self, seller_data: Dict) -> bool:
        """Send onboarding email to new patron"""
        try:
            # This will be implemented in the onboarding-automation module
            logger.info(f"Onboarding email sent to: {seller_data.get('email')}")
            # Call email service here
            return True
        except Exception as e:
            logger.error(f"Error sending onboarding email: {e}")
            return False

    def send_cancellation_email(self, seller_data: Dict) -> bool:
        """Send cancellation confirmation email"""
        try:
            logger.info(f"Cancellation email sent to seller: {seller_data['seller_id']}")
            # Call email service here
            return True
        except Exception as e:
            logger.error(f"Error sending cancellation email: {e}")
            return False

    def send_cancellation_warning_email(self, seller_data: Dict) -> bool:
        """Send warning email when subscription is set to cancel"""
        try:
            logger.info(f"Cancellation warning sent to seller: {seller_data['seller_id']}")
            # Call email service here
            return True
        except Exception as e:
            logger.error(f"Error sending cancellation warning: {e}")
            return False


# Initialize handler
webhook_handler = StripeWebhookHandler()


@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Stripe webhook endpoint"""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    # Verify webhook signature
    event = webhook_handler.verify_signature(payload, sig_header)

    if not event:
        return jsonify({'error': 'Invalid signature'}), 400

    # Handle event
    result = webhook_handler.handle_event(event)

    return jsonify(result), 200


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'stripe-webhook-handler',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    # Run Flask app
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
