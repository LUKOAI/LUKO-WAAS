#!/usr/bin/env python3
"""
WAAS 2.0 - Bland.ai Calling Integration
========================================

Automated AI calling system for seller outreach and qualification using Bland.ai.

Bland.ai is simpler and more affordable than Vapi.ai, with excellent call quality.

Features:
- Automated cold calling
- Natural conversation AI
- Call recording and analysis
- Lead qualification
- Webinar scheduling
"""

import os
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BLAND_API_KEY = os.getenv('BLAND_API_KEY')
BLAND_API_URL = 'https://api.bland.ai/v1/calls'


class BlandCaller:
    """Bland.ai integration for automated AI calling"""

    def __init__(self):
        self.api_key = BLAND_API_KEY
        self.api_url = BLAND_API_URL

    def create_call_task(self, seller_data: Dict) -> Dict:
        """Create call task with personalized script"""

        task = f"""
Your name is Alex from WAAS (WordPress Affiliate Automation System).

You are calling {seller_data.get('contact_name', seller_data.get('brand_name', 'the seller'))}.

**Background:**
- They sell {seller_data.get('product_category', 'products')} on Amazon
- We've already created a website featuring their products
- The site is getting traffic and generating clicks to their Amazon listings

**Your Goal:**
Qualify them for our €50/month patronage program and invite them to a 10-minute demo webinar.

**Call Script:**

1. INTRODUCTION
"Hi, is this {seller_data.get('contact_name', 'the right person')}?"
[Wait for response]
"Great! This is Alex from WAAS. I'm calling because we've created a website specifically featuring your {seller_data.get('product_category', 'Amazon products')}."

2. VALUE HOOK
"The site is already ranking in Google and sending traffic to your Amazon listings. We've generated {seller_data.get('clicks_last_month', '47')} clicks to your products this month."
[Pause for reaction]

3. TRANSITION TO OFFER
"I wanted to reach out because we can increase this traffic by 3 to 5 times through our patronage program - and it costs less than a single Amazon PPC click per day."

4. QUALIFICATION QUESTION
"Are you currently looking to increase your Amazon sales through external traffic?"

IF YES:
"Perfect! What's your current monthly budget for Amazon advertising?"

IF they mention budget >€200/month:
[QUALIFIED - Proceed to webinar invite]
"Excellent! I think you'd be a great fit. I'd like to invite you to a quick 10-minute demo that shows exactly how this works. I have a slot available tomorrow at 2 PM. Does that work for you?"

IF they say yes to webinar:
"Perfect! What email should I send the webinar link to?"
[Get email]
"Great! You'll receive the link in the next few minutes. Looking forward to showing you what we've built!"
[End call - Mark as QUALIFIED]

IF they say no to webinar:
"No problem! What time works better for you this week?"
[Try to schedule alternative time]
[End call - Mark as CALLBACK]

IF budget <€200/month or uncertain:
"I understand. How about I send you some information via email and we can schedule a quick chat next week?"
[Get email]
[End call - Mark as WARM]

IF NO to increasing sales:
"I understand. Can I ask - what's your main focus right now with your Amazon business?"
[Listen to response]
"That makes sense. Would it be okay if I send you some information via email that you can review when the timing is better?"
[Get email if yes]
[End call - Mark as NOT_INTERESTED or NURTURE]

5. OBJECTION HANDLING

"How much does it cost?"
→ "It's €50 per month - that's about €1.60 per day. Most Amazon sellers spend that on a single PPC click. This gets you a full dedicated website driving organic traffic 24/7."

"I need to talk to my partner/team"
→ "Absolutely! Why don't I send you the demo recording and some information? Then you can discuss it together and we can schedule a quick call next week."

"I'm already doing fine with my sales"
→ "That's great to hear! Are you interested in adding another traffic channel that requires no ongoing work from you once it's set up?"

"I don't have time right now"
→ "I completely understand. The demo is only 10 minutes. Or I can send you a recorded version you can watch at your convenience?"

"Send me information first"
→ "Sure! What email should I send it to? And would you be open to a quick 5-minute call next week after you've had a chance to review it?"

**IMPORTANT RULES:**
- Be friendly and professional, not pushy
- If they ask to be removed from list, apologize and end call immediately
- Maximum call duration: 3-4 minutes
- If no answer, leave voicemail and mark as NO_ANSWER
- Always try to get their email address
- Record call outcome: QUALIFIED, WARM, NOT_INTERESTED, CALLBACK, NO_ANSWER, REMOVED

**Call Ending:**
Always end with: "Thanks for your time {seller_data.get('contact_name', '')}! Have a great day!"
"""

        return {
            "phone_number": seller_data['phone'],
            "task": task,
            "voice": "maya",  # Professional female voice
            "reduce_latency": False,
            "wait_for_greeting": True,
            "record": True,
            "language": "en",
            "max_duration": 4,  # minutes
            "answered_by_enabled": True,
            "voicemail_message": f"Hi, this is Alex from WAAS calling about your Amazon business. I'll send you an email with details. Thanks!",
            "metadata": {
                "seller_id": seller_data.get('seller_id'),
                "brand_name": seller_data.get('brand_name'),
                "campaign": "cold_outreach_v1"
            }
        }

    def initiate_call(self, seller_data: Dict) -> Optional[Dict]:
        """Initiate AI call to seller"""
        try:
            task = self.create_call_task(seller_data)

            headers = {
                'authorization': self.api_key,
                'Content-Type': 'application/json'
            }

            response = requests.post(
                self.api_url,
                json=task,
                headers=headers,
                timeout=30
            )

            if response.status_code == 200:
                call_data = response.json()
                logger.info(f"Call initiated to {seller_data['phone']}: {call_data.get('call_id')}")

                return {
                    'success': True,
                    'call_id': call_data.get('call_id'),
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
            return {'success': False, 'error': str(e)}

    def get_call_details(self, call_id: str) -> Optional[Dict]:
        """Get details of a completed call"""
        try:
            url = f"{self.api_url}/{call_id}"
            headers = {'authorization': self.api_key}

            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get call details: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error getting call details: {e}")
            return None

    def analyze_call_outcome(self, call_data: Dict) -> Dict:
        """Analyze call outcome from Bland.ai response"""
        try:
            # Bland.ai provides analyzed data in response
            analysis = call_data.get('analysis', {})
            transcript = call_data.get('transcript', '')

            outcome = {
                'call_id': call_data.get('call_id'),
                'seller_id': call_data.get('metadata', {}).get('seller_id'),
                'duration_seconds': call_data.get('call_length', 0),
                'status': call_data.get('status', 'completed'),
                'answered': call_data.get('answered_by') == 'human',
                'qualification': 'NOT_QUALIFIED',
                'lead_score': 0,
                'next_action': 'none',
                'email_collected': False,
                'webinar_scheduled': False,
                'notes': ''
            }

            # Parse transcript for key indicators
            if transcript:
                transcript_lower = transcript.lower()

                # Check if email was collected
                if '@' in transcript or 'email' in transcript_lower:
                    outcome['email_collected'] = True
                    outcome['lead_score'] += 1

                # Check for webinar scheduling
                if 'webinar' in transcript_lower and ('yes' in transcript_lower or 'works' in transcript_lower):
                    outcome['webinar_scheduled'] = True
                    outcome['qualification'] = 'QUALIFIED'
                    outcome['lead_score'] += 3
                    outcome['next_action'] = 'send_webinar_invite'

                # Check for interest signals
                if any(word in transcript_lower for word in ['interested', 'sounds good', 'tell me more', 'yes']):
                    outcome['lead_score'] += 2
                    outcome['qualification'] = 'WARM'

                # Check for budget discussion
                if 'budget' in transcript_lower or 'price' in transcript_lower or 'cost' in transcript_lower:
                    outcome['lead_score'] += 1

                # Check for callback request
                if 'call back' in transcript_lower or 'next week' in transcript_lower:
                    outcome['qualification'] = 'CALLBACK'
                    outcome['next_action'] = 'schedule_callback'

                # Check for rejection signals
                if any(word in transcript_lower for word in ['not interested', 'no thanks', 'remove', 'don\'t call']):
                    outcome['qualification'] = 'NOT_INTERESTED'
                    outcome['next_action'] = 'remove_from_list'
                    outcome['lead_score'] = 0

            # No answer scenarios
            if not outcome['answered'] or call_data.get('answered_by') != 'human':
                outcome['qualification'] = 'NO_ANSWER'
                outcome['next_action'] = 'retry_call'

            # Final scoring
            if outcome['lead_score'] >= 3:
                outcome['qualification'] = 'QUALIFIED'
            elif outcome['lead_score'] >= 1:
                outcome['qualification'] = 'WARM'
                if outcome['next_action'] == 'none':
                    outcome['next_action'] = 'send_follow_up_email'

            return outcome

        except Exception as e:
            logger.error(f"Error analyzing call: {e}")
            return {'status': 'error', 'error': str(e)}

    def batch_call_sellers(self, sellers: List[Dict], delay_seconds: int = 60) -> List[Dict]:
        """Call multiple sellers with delay"""
        import time

        results = []

        for seller in sellers:
            logger.info(f"Calling: {seller.get('brand_name')} ({seller.get('phone')})")

            result = self.initiate_call(seller)
            results.append(result)

            if len(sellers) > 1:
                logger.info(f"Waiting {delay_seconds}s before next call...")
                time.sleep(delay_seconds)

        return results


# Flask webhook handler
from flask import Flask, request, jsonify

app = Flask(__name__)
bland_caller = BlandCaller()


@app.route('/webhook/bland/call-completed', methods=['POST'])
def bland_call_completed():
    """Webhook for Bland.ai call completion"""
    try:
        call_data = request.json

        logger.info(f"Received Bland.ai webhook for call: {call_data.get('call_id')}")

        # Analyze call outcome
        outcome = bland_caller.analyze_call_outcome(call_data)

        logger.info(f"Call outcome: {outcome['qualification']} (score: {outcome['lead_score']})")

        # Take action based on outcome
        if outcome['next_action'] == 'send_webinar_invite':
            logger.info("→ Sending webinar invitation")
            # Trigger webinar invitation

        elif outcome['next_action'] == 'send_follow_up_email':
            logger.info("→ Sending follow-up email")
            # Trigger email

        elif outcome['next_action'] == 'schedule_callback':
            logger.info("→ Scheduling callback")
            # Add to callback queue

        elif outcome['next_action'] == 'remove_from_list':
            logger.info("→ Removing from call list")
            # Update CRM

        return jsonify({'status': 'success', 'outcome': outcome}), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'bland-caller',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5003))
    app.run(host='0.0.0.0', port=port, debug=False)
