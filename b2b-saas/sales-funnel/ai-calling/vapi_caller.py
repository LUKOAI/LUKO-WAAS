#!/usr/bin/env python3
"""
WAAS 2.0 - Vapi.ai Calling Integration
=======================================

Automated AI calling system for seller outreach and qualification using Vapi.ai.

Features:
- Automated cold calling to Amazon sellers
- Qualification of potential patrons
- Meeting/webinar scheduling
- Call recording and transcription
- Lead scoring

Flow:
1. Fetch seller contact from CRM (Google Sheets)
2. Initiate AI call via Vapi.ai
3. AI qualifies seller (interest, budget, fit)
4. If qualified → Schedule webinar
5. Update CRM with call outcome
6. Send follow-up email
"""

import os
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
VAPI_API_KEY = os.getenv('VAPI_API_KEY')
VAPI_API_URL = 'https://api.vapi.ai/call'
VAPI_PHONE_NUMBER = os.getenv('VAPI_PHONE_NUMBER')
VAPI_ASSISTANT_ID = os.getenv('VAPI_ASSISTANT_ID')


class VapiCaller:
    """Vapi.ai integration for automated AI calling"""

    def __init__(self):
        self.api_key = VAPI_API_KEY
        self.api_url = VAPI_API_URL
        self.phone_number = VAPI_PHONE_NUMBER
        self.assistant_id = VAPI_ASSISTANT_ID

    def create_call_script(self, seller_data: Dict) -> Dict:
        """Create personalized call script for the seller"""

        script = {
            "model": {
                "provider": "openai",
                "model": "gpt-4",
                "temperature": 0.7,
                "systemPrompt": f"""
You are a professional business development representative calling on behalf of WAAS (WordPress Affiliate Automation System).

**Seller Information:**
- Name: {seller_data.get('brand_name', 'the seller')}
- Products: {seller_data.get('product_category', 'Amazon products')}
- Current Amazon presence: {seller_data.get('amazon_presence', 'Active seller')}

**Your Goal:**
Qualify this Amazon seller for our patronage program where we create dedicated affiliate websites for their products.

**Call Structure:**

1. **Introduction (15 seconds)**
   - "Hi, this is Alex from WAAS. I'm calling because we've created a website specifically featuring your products on Amazon."
   - Wait for response

2. **Value Proposition (30 seconds)**
   - "We rank these sites in Google search results and drive traffic directly to your Amazon listings."
   - "We've already generated [X] clicks to your products this month."
   - "I wanted to discuss how we can increase this traffic by 3-5x with our patronage program."

3. **Qualification Questions:**
   - "Are you currently looking to increase your Amazon sales?"
   - "What's your monthly advertising budget for Amazon?"
   - "Have you tried external traffic sources before?"

4. **Scoring Criteria:**
   - Interested in growth: +2 points
   - Budget >€200/month: +2 points
   - Tried external traffic: +1 point
   - Total ≥3 points = QUALIFIED

5. **If Qualified:**
   - "Perfect! I'd like to invite you to a 10-minute demo showing exactly how this works."
   - "I have a slot available [WEBINAR_TIME]. Does that work for you?"
   - If YES → Get email, schedule webinar
   - If NO → Get preferred time, mark for follow-up

6. **If Not Qualified:**
   - "I understand. Let me send you some information via email."
   - Get email address
   - Mark as "nurture" in CRM

7. **Objection Handling:**
   - "Too expensive" → "It's only €50/month - less than one Amazon PPC click per day"
   - "Not interested" → "Can I ask what's holding you back?"
   - "Need to think" → "Of course! Can I schedule a quick 5-minute call next week?"

**Important:**
- Be professional but friendly
- Listen more than you talk
- Never sound pushy
- If they say "remove from list" → Apologize and end call
- Maximum call length: 3 minutes

**Call Outcome:**
Record one of: QUALIFIED, NOT_QUALIFIED, CALLBACK, NO_ANSWER, REMOVED
"""
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "rachel",  # Professional female voice
                "stability": 0.5,
                "similarityBoost": 0.75,
                "style": 0.0,
                "useSpeakerBoost": True
            },
            "firstMessage": f"Hi, is this {seller_data.get('contact_name', 'the right person')} from {seller_data.get('brand_name', 'your company')}?",
            "recordingEnabled": True,
            "endCallFunctionEnabled": True,
            "dialKeypadFunctionEnabled": False,
            "fillersEnabled": True,
            "metadata": {
                "seller_id": seller_data.get('seller_id'),
                "brand_name": seller_data.get('brand_name'),
                "campaign": "cold_outreach_v1"
            }
        }

        return script

    def initiate_call(self, seller_data: Dict) -> Optional[Dict]:
        """Initiate an AI call to a seller"""
        try:
            # Create call script
            script = self.create_call_script(seller_data)

            # Prepare API request
            url = self.api_url
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            payload = {
                "assistantId": self.assistant_id,
                "customer": {
                    "number": seller_data['phone'],  # Seller's phone number
                    "name": seller_data.get('contact_name', seller_data.get('brand_name', 'Seller'))
                },
                "phoneNumberId": self.phone_number,  # Your Vapi phone number
                **script
            }

            # Make API call
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 201:
                call_data = response.json()
                logger.info(f"Call initiated successfully to {seller_data['phone']}: {call_data['id']}")

                return {
                    'success': True,
                    'call_id': call_data['id'],
                    'status': call_data.get('status'),
                    'seller_id': seller_data['seller_id']
                }
            else:
                logger.error(f"Failed to initiate call: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': response.text
                }

        except Exception as e:
            logger.error(f"Error initiating call: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_call_status(self, call_id: str) -> Optional[Dict]:
        """Get status of an ongoing or completed call"""
        try:
            url = f"{self.api_url}/{call_id}"
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }

            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get call status: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error getting call status: {e}")
            return None

    def get_call_transcript(self, call_id: str) -> Optional[str]:
        """Get transcript of completed call"""
        try:
            call_data = self.get_call_status(call_id)

            if call_data and call_data.get('transcript'):
                return call_data['transcript']
            else:
                logger.warning(f"No transcript available for call {call_id}")
                return None

        except Exception as e:
            logger.error(f"Error getting transcript: {e}")
            return None

    def analyze_call_outcome(self, call_data: Dict) -> Dict:
        """Analyze call outcome and extract key information"""
        try:
            transcript = call_data.get('transcript', '')
            metadata = call_data.get('metadata', {})

            # Extract outcome from transcript using simple keyword matching
            # In production, use AI to analyze transcript

            outcome = {
                'call_id': call_data.get('id'),
                'seller_id': metadata.get('seller_id'),
                'duration_seconds': call_data.get('duration', 0),
                'status': 'completed',
                'qualification': 'NOT_QUALIFIED',
                'lead_score': 0,
                'next_action': 'none',
                'scheduled_webinar': False,
                'notes': ''
            }

            # Analyze transcript for qualification signals
            if transcript:
                transcript_lower = transcript.lower()

                # Positive signals
                if any(word in transcript_lower for word in ['interested', 'yes', 'sounds good', 'tell me more']):
                    outcome['lead_score'] += 2
                    outcome['qualification'] = 'INTERESTED'

                if any(word in transcript_lower for word in ['budget', 'how much', 'pricing']):
                    outcome['lead_score'] += 1

                if 'webinar' in transcript_lower and 'yes' in transcript_lower:
                    outcome['scheduled_webinar'] = True
                    outcome['qualification'] = 'QUALIFIED'
                    outcome['lead_score'] += 3
                    outcome['next_action'] = 'send_webinar_invite'

                # Negative signals
                if any(word in transcript_lower for word in ['not interested', 'no thanks', 'remove', 'stop calling']):
                    outcome['qualification'] = 'NOT_INTERESTED'
                    outcome['next_action'] = 'remove_from_list'

                if any(word in transcript_lower for word in ['call back', 'later', 'busy']):
                    outcome['qualification'] = 'CALLBACK'
                    outcome['next_action'] = 'schedule_callback'

            # Final qualification based on score
            if outcome['lead_score'] >= 3:
                outcome['qualification'] = 'QUALIFIED'
                outcome['next_action'] = 'send_webinar_invite'
            elif outcome['lead_score'] >= 1:
                outcome['qualification'] = 'WARM'
                outcome['next_action'] = 'send_follow_up_email'

            return outcome

        except Exception as e:
            logger.error(f"Error analyzing call outcome: {e}")
            return {'status': 'error', 'error': str(e)}

    def batch_call_sellers(self, sellers: List[Dict], delay_seconds: int = 60) -> List[Dict]:
        """Initiate calls to multiple sellers with delay between calls"""
        import time

        results = []

        for seller in sellers:
            logger.info(f"Calling seller: {seller.get('brand_name')} ({seller.get('phone')})")

            result = self.initiate_call(seller)
            results.append(result)

            # Delay between calls
            if len(sellers) > 1:
                logger.info(f"Waiting {delay_seconds} seconds before next call...")
                time.sleep(delay_seconds)

        return results


# Webhook handler for call completion events
from flask import Flask, request, jsonify

app = Flask(__name__)
vapi_caller = VapiCaller()


@app.route('/webhook/vapi/call-completed', methods=['POST'])
def vapi_call_completed():
    """Webhook endpoint for Vapi call completion events"""
    try:
        event_data = request.json

        logger.info(f"Received Vapi webhook: {event_data.get('type')}")

        if event_data.get('type') == 'call.ended':
            call_data = event_data.get('call', {})

            # Analyze call outcome
            outcome = vapi_caller.analyze_call_outcome(call_data)

            logger.info(f"Call outcome: {outcome['qualification']} (score: {outcome['lead_score']})")

            # Update CRM with call outcome
            # This will be handled by the CRM integration module

            # Take next action based on outcome
            if outcome['next_action'] == 'send_webinar_invite':
                logger.info("Sending webinar invitation...")
                # Trigger webinar invitation

            elif outcome['next_action'] == 'send_follow_up_email':
                logger.info("Sending follow-up email...")
                # Trigger follow-up email

            elif outcome['next_action'] == 'schedule_callback':
                logger.info("Scheduling callback...")
                # Schedule callback

            elif outcome['next_action'] == 'remove_from_list':
                logger.info("Removing from call list...")
                # Remove from CRM

            return jsonify({'status': 'success', 'outcome': outcome}), 200

        return jsonify({'status': 'ignored'}), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'vapi-caller',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=False)
