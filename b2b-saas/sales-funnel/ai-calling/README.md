# WAAS 2.0 - AI Calling Integration

Automated AI calling system for seller outreach and qualification.

## Providers

### 1. Vapi.ai
- Advanced conversational AI
- Multiple voice providers (11labs, PlayHT, etc.)
- Real-time call control
- Best for complex conversations
- **Pricing:** ~$0.10-0.15 per minute

### 2. Bland.ai
- Simpler, more affordable
- Excellent call quality
- Easy to set up
- Great for straightforward scripts
- **Pricing:** ~$0.05-0.09 per minute

## Features

✅ **Automated Cold Calling** - AI calls sellers automatically
✅ **Lead Qualification** - AI qualifies leads based on conversation
✅ **Webinar Scheduling** - AI schedules demo webinars
✅ **Call Recording** - All calls recorded and transcribed
✅ **CRM Integration** - Updates CRM with call outcomes
✅ **Follow-up Automation** - Triggers emails based on call results

## Call Flow

```
1. Fetch seller from CRM (Google Sheets)
   ↓
2. AI initiates call to seller
   ↓
3. AI introduces WAAS and value proposition
   ↓
4. AI qualifies seller (budget, interest, fit)
   ↓
5. If QUALIFIED:
   - Schedule webinar
   - Collect email
   - Send webinar invite
   ↓
6. If WARM:
   - Collect email
   - Send follow-up info
   ↓
7. If NOT INTERESTED:
   - Mark in CRM
   - Stop outreach
   ↓
8. Update CRM with outcome
```

## Installation

### 1. Choose Provider

**For Vapi.ai:**
```bash
cd b2b-saas/sales-funnel/ai-calling
pip install -r requirements.txt
```

**For Bland.ai:**
```bash
cd b2b-saas/sales-funnel/ai-calling
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

### 3. Run Service

**Vapi.ai:**
```bash
python vapi_caller.py
```

**Bland.ai:**
```bash
python bland_caller.py
```

## Vapi.ai Setup

### 1. Sign Up

1. Go to https://vapi.ai
2. Create account
3. Get API key from dashboard

### 2. Create Assistant

1. In Vapi dashboard → **Assistants** → **Create**
2. Name: "WAAS Sales Agent"
3. Model: GPT-4
4. Voice: 11labs - Rachel (professional female)
5. Copy Assistant ID

### 3. Get Phone Number

1. **Phone Numbers** → **Buy Number**
2. Choose a professional-sounding number
3. Copy Phone Number ID

### 4. Configure Webhook

1. **Webhooks** → **Add Endpoint**
2. URL: `https://your-domain.com/webhook/vapi/call-completed`
3. Events: `call.ended`

## Bland.ai Setup

### 1. Sign Up

1. Go to https://bland.ai
2. Create account
3. Get API key from settings

### 2. Configure Webhook

1. In dashboard → **Settings** → **Webhooks**
2. URL: `https://your-domain.com/webhook/bland/call-completed`
3. Save

## Usage

### Single Call

**Vapi.ai:**
```python
from vapi_caller import VapiCaller

caller = VapiCaller()

seller = {
    'seller_id': 'AMZN-SELLER-123',
    'brand_name': 'Example Brand',
    'contact_name': 'John Doe',
    'phone': '+491234567890',
    'product_category': 'outdoor gear',
    'clicks_last_month': 47
}

result = caller.initiate_call(seller)
print(result)
```

**Bland.ai:**
```python
from bland_caller import BlandCaller

caller = BlandCaller()

seller = {
    'seller_id': 'AMZN-SELLER-123',
    'brand_name': 'Example Brand',
    'contact_name': 'John Doe',
    'phone': '+491234567890',
    'product_category': 'outdoor gear',
    'clicks_last_month': 47
}

result = caller.initiate_call(seller)
print(result)
```

### Batch Calling

```python
sellers = [
    {...},
    {...},
    {...}
]

results = caller.batch_call_sellers(sellers, delay_seconds=120)
```

## Call Script Customization

Edit the `create_call_script()` or `create_call_task()` method to customize:

- Introduction message
- Value proposition
- Qualification questions
- Objection handling
- Call-to-action

## Lead Scoring

Calls are automatically scored:

| Score | Qualification | Next Action |
|-------|---------------|-------------|
| 3+ | QUALIFIED | Send webinar invite |
| 1-2 | WARM | Send follow-up email |
| 0 | NOT_INTERESTED | Stop outreach |
| - | CALLBACK | Schedule callback |
| - | NO_ANSWER | Retry call later |

## Call Outcomes

Possible outcomes:
- `QUALIFIED` - Ready for webinar
- `WARM` - Interested, needs nurturing
- `NOT_INTERESTED` - Not a fit
- `CALLBACK` - Requested callback
- `NO_ANSWER` - Didn't answer
- `REMOVED` - Requested removal

## Integration with CRM

After each call, outcome is sent to CRM (Google Sheets):

```python
# Update CRM with call outcome
update_crm({
    'seller_id': outcome['seller_id'],
    'call_status': outcome['qualification'],
    'lead_score': outcome['lead_score'],
    'next_action': outcome['next_action'],
    'call_date': datetime.now(),
    'notes': outcome['notes']
})
```

## Best Practices

✅ **Call during business hours** - 9 AM - 6 PM local time
✅ **Respect opt-outs** - Immediately remove if requested
✅ **Keep calls short** - Max 3-4 minutes
✅ **Personalize** - Use seller name and product category
✅ **Follow up quickly** - Send webinar invite within 5 minutes
✅ **Monitor quality** - Review transcripts regularly

## Compliance

⚠️ **GDPR** - For EU sellers, ensure compliance
⚠️ **Opt-out** - Honor all removal requests immediately
⚠️ **Recording** - Inform callers that calls are recorded
⚠️ **DNC Lists** - Check Do Not Call registries

## Monitoring

### View Call Logs

```bash
# Check application logs
tail -f /var/log/waas-ai-calling.log
```

### Health Check

```bash
curl https://your-domain.com/health
```

## Pricing Comparison

| Provider | Cost/Min | Setup | Quality | Ease |
|----------|----------|-------|---------|------|
| Vapi.ai | $0.10-0.15 | Medium | Excellent | Complex |
| Bland.ai | $0.05-0.09 | Easy | Great | Simple |

**Recommendation:**
- Start with Bland.ai for simplicity
- Upgrade to Vapi.ai for advanced features

## Troubleshooting

### Calls Not Initiating

1. Check API key is valid
2. Verify phone number format (+country code)
3. Check balance/credits in provider dashboard

### Poor Call Quality

1. Review and simplify call script
2. Adjust voice settings (speed, stability)
3. Test with different voices

### Low Qualification Rate

1. Review call transcripts
2. Adjust qualification criteria
3. Improve value proposition in script

## Support

GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
