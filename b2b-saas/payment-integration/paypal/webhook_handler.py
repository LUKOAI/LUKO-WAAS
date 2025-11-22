#!/usr/bin/env python3
"""
WAAS 2.0 - PayPal Webhook Handler
==================================

Handles PayPal payment webhooks and automatically activates patronage
when a seller subscribes.

Events handled:
- PAYMENT.SALE.COMPLETED - One-time payment completed
- BILLING.SUBSCRIPTION.CREATED - Subscription created
- BILLING.SUBSCRIPTION.ACTIVATED - Subscription activated
- PAYMENT.SALE.REFUNDED - Payment refunded
- BILLING.SUBSCRIPTION.CANCELLED - Subscription cancelled
- BILLING.SUBSCRIPTION.SUSPENDED - Subscription suspended

Flow:
1. Receive PayPal webhook
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
PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID')
PAYPAL_CLIENT_SECRET = os.getenv('PAYPAL_CLIENT_SECRET')
PAYPAL_WEBHOOK_ID = os.getenv('PAYPAL_WEBHOOK_ID')
PAYPAL_MODE = os.getenv('PAYPAL_MODE', 'sandbox')  # sandbox or live
WORDPRESS_API_URL = os.getenv('WORDPRESS_API_URL')
WORDPRESS_API_KEY = os.getenv('WORDPRESS_API_KEY')

# PayPal API URLs
PAYPAL_API_BASE = {
    'sandbox': 'https://api-m.sandbox.paypal.com',
    'live': 'https://api-m.paypal.com'
}


class PayPalWebhookHandler:
    """Handles PayPal webhook events and triggers patronage activation"""

    def __init__(self):
        self.client_id = PAYPAL_CLIENT_ID
        self.client_secret = PAYPAL_CLIENT_SECRET
        self.webhook_id = PAYPAL_WEBHOOK_ID
        self.api_base = PAYPAL_API_BASE[PAYPAL_MODE]
        self.wordpress_api_url = WORDPRESS_API_URL
        self.wordpress_api_key = WORDPRESS_API_KEY
        self.access_token = None

    def get_access_token(self) -> Optional[str]:
        """Get PayPal OAuth access token"""
        try:
            url = f"{self.api_base}/v1/oauth2/token"
            headers = {
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
            }
            data = {'grant_type': 'client_credentials'}

            response = requests.post(
                url,
                headers=headers,
                data=data,
                auth=(self.client_id, self.client_secret),
                timeout=30
            )

            if response.status_code == 200:
                self.access_token = response.json()['access_token']
                return self.access_token
            else:
                logger.error(f"Failed to get access token: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error getting access token: {e}")
            return None

    def verify_webhook_signature(self, headers: Dict, body: str) -> bool:
        """Verify PayPal webhook signature"""
        try:
            # Get required headers
            transmission_id = headers.get('Paypal-Transmission-Id')
            transmission_time = headers.get('Paypal-Transmission-Time')
            cert_url = headers.get('Paypal-Cert-Url')
            auth_algo = headers.get('Paypal-Auth-Algo')
            transmission_sig = headers.get('Paypal-Transmission-Sig')

            if not all([transmission_id, transmission_time, cert_url, auth_algo, transmission_sig]):
                logger.error("Missing required webhook headers")
                return False

            # Get access token
            if not self.access_token:
                self.get_access_token()

            # Verify signature via PayPal API
            url = f"{self.api_base}/v1/notifications/verify-webhook-signature"

            payload = {
                'transmission_id': transmission_id,
                'transmission_time': transmission_time,
                'cert_url': cert_url,
                'auth_algo': auth_algo,
                'transmission_sig': transmission_sig,
                'webhook_id': self.webhook_id,
                'webhook_event': json.loads(body)
            }

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.access_token}'
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 200:
                result = response.json()
                if result.get('verification_status') == 'SUCCESS':
                    logger.info("Webhook signature verified successfully")
                    return True
                else:
                    logger.error(f"Signature verification failed: {result}")
                    return False
            else:
                logger.error(f"Signature verification request failed: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False

    def extract_seller_data(self, event: Dict) -> Optional[Dict]:
        """Extract seller data from PayPal event"""
        try:
            event_type = event['event_type']
            resource = event.get('resource', {})

            # Extract custom data from resource
            custom_id = resource.get('custom_id', '')

            # Custom ID should contain seller data in format:
            # seller_id|brand_name|logo_url|email|phone|website
            if custom_id:
                parts = custom_id.split('|')
                if len(parts) >= 4:
                    seller_data = {
                        'seller_id': parts[0] if len(parts) > 0 else '',
                        'brand_name': parts[1] if len(parts) > 1 else '',
                        'logo_url': parts[2] if len(parts) > 2 else '',
                        'email': parts[3] if len(parts) > 3 else '',
                        'phone': parts[4] if len(parts) > 4 else '',
                        'website': parts[5] if len(parts) > 5 else '',
                        'brand_story': parts[6] if len(parts) > 6 else '',
                    }
                else:
                    logger.warning(f"Invalid custom_id format: {custom_id}")
                    seller_data = {'seller_id': custom_id}
            else:
                # Try to extract from other fields
                seller_data = {
                    'seller_id': resource.get('id', ''),
                    'email': resource.get('payer', {}).get('email_address', ''),
                }

            # Add payment details
            if event_type in ['PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED']:
                seller_data.update({
                    'amount': float(resource.get('amount', {}).get('total', 0)),
                    'currency': resource.get('amount', {}).get('currency', 'EUR'),
                    'payment_id': resource.get('id'),
                    'payment_status': resource.get('state'),
                    'subscription_type': 'one-time',
                })

            elif event_type.startswith('BILLING.SUBSCRIPTION.'):
                subscription_id = resource.get('id')

                # Fetch subscription details
                subscription = self.get_subscription_details(subscription_id)

                if subscription:
                    seller_data.update({
                        'subscription_id': subscription_id,
                        'subscription_status': subscription.get('status'),
                        'amount': float(subscription.get('billing_info', {}).get('last_payment', {}).get('amount', {}).get('value', 0)),
                        'currency': subscription.get('billing_info', {}).get('last_payment', {}).get('amount', {}).get('currency_code', 'EUR'),
                        'subscription_type': 'subscription',
                    })

            return seller_data

        except Exception as e:
            logger.error(f"Error extracting seller data: {e}")
            return None

    def get_subscription_details(self, subscription_id: str) -> Optional[Dict]:
        """Get PayPal subscription details"""
        try:
            if not self.access_token:
                self.get_access_token()

            url = f"{self.api_base}/v1/billing/subscriptions/{subscription_id}"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.access_token}'
            }

            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get subscription details: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error getting subscription details: {e}")
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
                logger.error(f"Failed to deactivate patronage: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error calling WordPress API: {e}")
            return False

    def handle_event(self, event: Dict) -> Dict[str, Any]:
        """Main event handler"""
        event_type = event['event_type']
        logger.info(f"Processing PayPal event: {event_type}")

        seller_data = self.extract_seller_data(event)

        if not seller_data:
            logger.warning(f"No seller data extracted from event: {event_type}")
            return {'status': 'error', 'message': 'No seller data found'}

        # Handle different event types
        if event_type == 'PAYMENT.SALE.COMPLETED':
            # One-time payment completed
            success = self.activate_patronage(seller_data)
            if success:
                return {'status': 'success', 'action': 'patronage_activated'}
            else:
                return {'status': 'error', 'message': 'Failed to activate patronage'}

        elif event_type == 'BILLING.SUBSCRIPTION.ACTIVATED':
            # Subscription activated
            success = self.activate_patronage(seller_data)
            if success:
                return {'status': 'success', 'action': 'patronage_activated'}
            else:
                return {'status': 'error', 'message': 'Failed to activate patronage'}

        elif event_type == 'BILLING.SUBSCRIPTION.CANCELLED':
            # Subscription cancelled
            success = self.deactivate_patronage(seller_data['seller_id'])
            if success:
                return {'status': 'success', 'action': 'patronage_deactivated'}
            else:
                return {'status': 'error', 'message': 'Failed to deactivate patronage'}

        elif event_type == 'BILLING.SUBSCRIPTION.SUSPENDED':
            # Subscription suspended - deactivate patronage
            success = self.deactivate_patronage(seller_data['seller_id'])
            if success:
                return {'status': 'success', 'action': 'patronage_suspended'}
            else:
                return {'status': 'error', 'message': 'Failed to suspend patronage'}

        elif event_type == 'PAYMENT.SALE.REFUNDED':
            # Payment refunded - deactivate patronage
            success = self.deactivate_patronage(seller_data['seller_id'])
            if success:
                return {'status': 'success', 'action': 'patronage_refunded'}
            else:
                return {'status': 'error', 'message': 'Failed to handle refund'}

        return {'status': 'ignored', 'message': f'Event type not handled: {event_type}'}


# Initialize handler
webhook_handler = PayPalWebhookHandler()


@app.route('/webhook', methods=['POST'])
def paypal_webhook():
    """PayPal webhook endpoint"""
    try:
        # Get request data
        body = request.data.decode('utf-8')
        headers = dict(request.headers)

        # Verify webhook signature
        if not webhook_handler.verify_webhook_signature(headers, body):
            logger.error("Webhook signature verification failed")
            return jsonify({'error': 'Invalid signature'}), 400

        # Parse event
        event = json.loads(body)

        # Handle event
        result = webhook_handler.handle_event(event)

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'paypal-webhook-handler',
        'timestamp': datetime.utcnow().isoformat(),
        'mode': PAYPAL_MODE
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
