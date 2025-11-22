# WAAS 2.0 - EverWebinar Automation

Automated webinar funnel for converting qualified leads into paying customers.

## Features

✅ **Automated Registration** - Registers qualified leads automatically
✅ **Smart Scheduling** - Next available webinar time
✅ **Automated Reminders** - 24h, 1h, 15min before webinar
✅ **Attendance Tracking** - Tracks who attended and for how long
✅ **Smart Follow-up** - Different actions based on attendance
✅ **Conversion Tracking** - Tracks webinar → customer conversion

## Webinar Funnel Flow

```
QUALIFIED LEAD (from AI call)
   ↓
REGISTER FOR WEBINAR
   ↓
CONFIRMATION EMAIL SENT
   ↓
REMINDER EMAILS (24h, 1h, 15min)
   ↓
WEBINAR ATTENDANCE
   ↓
┌──────────────────────────────┐
│  Did they attend?             │
└──────────────────────────────┘
        ↓                    ↓
      YES                   NO
        ↓                    ↓
 Watch time?          Send replay link
        ↓
┌──────────────────────────────────┐
│ 8+ min: HOT LEAD                 │
│ → Send payment link immediately  │
│ → Lead score: 10                 │
└──────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│ 3-7 min: WARM LEAD               │
│ → Send replay + payment link     │
│ → Lead score: 5-8                │
└──────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│ <3 min: COLD                     │
│ → Send replay only               │
│ → Lead score: 3                  │
└──────────────────────────────────┘
```

## Installation

```bash
cd b2b-saas/sales-funnel/everwebinar
pip install -r requirements.txt
```

## Configuration

```bash
cp .env.example .env
nano .env
```

## EverWebinar Setup

### 1. Create Account

1. Go to https://everwebinar.com
2. Sign up (or use WebinarJam + EverWebinar bundle)
3. Get API key from settings

### 2. Create Automated Webinar

1. **Create New Webinar**
   - Name: "WAAS Patronage Demo"
   - Duration: 10-15 minutes
   - Type: Automated (pre-recorded)

2. **Upload Video**
   - Record 10-15 minute demo showing:
     - How WAAS works
     - Example affiliate site
     - Traffic stats
     - Pricing and benefits
     - Clear call-to-action

3. **Schedule**
   - Daily at 2 PM and 6 PM (or your preferred times)
   - Just-in-time webinars (appear live)

4. **Registration Page**
   - Customize branding
   - Collect: Name, Email, Phone
   - Add custom fields: seller_id, brand_name

5. **Thank You Page**
   - Add webinar access link
   - Add to calendar buttons
   - Reminder message

6. **Offer/CTA**
   - Add CTA button during webinar
   - Links to payment page
   - Track clicks

### 3. Configure Webhooks

1. **Settings** → **Integrations** → **Webhooks**
2. Add webhook URL: `https://your-domain.com/webhook/everwebinar/attended`
3. Events:
   - `webinar.registered`
   - `webinar.attended`
   - `offer.clicked`

## Usage

### Register Lead from AI Call

```python
from webinar_automation import EverWebinarAutomation

automation = EverWebinarAutomation()

lead = {
    'email': 'seller@example.com',
    'first_name': 'John',
    'last_name': 'Doe',
    'phone': '+491234567890',
    'seller_id': 'AMZN-SELLER-123',
    'brand_name': 'Example Brand',
    'qualification': 'QUALIFIED'
}

result = automation.register_attendee(lead)
print(result)
# {
#   'success': True,
#   'webinar_url': 'https://...',
#   'webinar_time': '2025-11-23T14:00:00'
# }
```

### Check Attendance

```python
status = automation.get_attendee_status('seller@example.com')
print(status)
# {
#   'attended': True,
#   'watch_time_minutes': 12,
#   'clicked_cta': True
# }
```

## Email Templates

### Registration Confirmation

**Subject:** You're registered! WAAS Patronage Demo

```
Hi {first_name},

You're all set for the WAAS Patronage Demo!

🗓️ Date: {webinar_date}
⏰ Time: {webinar_time}
🔗 Join link: {webinar_url}

What you'll learn:
✅ How we drive traffic to your Amazon products
✅ Real results from existing sellers
✅ Exclusive patronage benefits
✅ Special pricing (limited time)

Add to calendar: [Button]

See you there!

Alex
WAAS Team
```

### 24h Reminder

**Subject:** Tomorrow: WAAS Demo at {webinar_time}

```
Hi {first_name},

Quick reminder - your WAAS demo is tomorrow!

Time: {webinar_time}
Join: {webinar_url}

This will be a game-changer for your Amazon business.

See you tomorrow!
```

### Hot Lead (Clicked CTA)

**Subject:** Complete Your WAAS Patronage Setup

```
Hi {first_name},

Great to have you on the webinar!

I saw you clicked to learn more - here's your exclusive link:

👉 Get Started: {payment_url}

Special offer (expires in 24h):
€50/month → €40/month (first 3 months)

Questions? Reply to this email.

Best,
Alex
```

### No-Show (Replay)

**Subject:** Missed the webinar? Here's your replay

```
Hi {first_name},

I noticed you couldn't make the webinar.

No worries! Here's the replay:
🎥 Watch now: {replay_url}

It's only 12 minutes and shows exactly how we can grow your Amazon sales.

Questions? Just reply!

Best,
Alex
```

## Lead Scoring

| Scenario | Score | Action |
|----------|-------|--------|
| Attended + Clicked CTA | 10 | Payment link (urgent) |
| Attended 8+ min | 8 | Payment link (standard) |
| Attended 3-7 min | 5 | Replay + payment link |
| Attended <3 min | 3 | Replay only |
| No-show | 2 | Replay only |

## Integration with Sales Funnel

```python
# Complete funnel integration

# 1. AI Call qualifies lead
from vapi_caller import VapiCaller
caller = VapiCaller()
call_result = caller.initiate_call(seller)

# 2. If QUALIFIED → Register for webinar
if call_result['qualification'] == 'QUALIFIED':
    from webinar_automation import EverWebinarAutomation
    webinar = EverWebinarAutomation()
    reg_result = webinar.register_attendee(seller)

# 3. After webinar → Check attendance
    status = webinar.get_attendee_status(seller['email'])

# 4. If attended + clicked CTA → Payment
    if status['clicked_cta']:
        webinar.send_payment_link(seller['email'], urgency='high')

# 5. Payment webhook → Activate patronage
# (Handled by Stripe/PayPal webhook handlers)
```

## Monitoring

### View Webinar Stats

```bash
curl https://your-domain.com/api/stats
```

### Health Check

```bash
curl https://your-domain.com/health
```

## Best Practices

✅ **Keep webinar short** - 10-15 minutes max
✅ **Clear CTA** - One clear next step
✅ **Urgency** - Limited-time offer
✅ **Social proof** - Show real results
✅ **Multiple times** - Offer 2-3 daily time slots
✅ **Follow up fast** - Send payment link within 5 minutes

## Alternative to EverWebinar

If you don't want to use EverWebinar:

### Option 1: WebinarJam (Live Webinars)
- More personal
- Q&A capability
- Higher conversion

### Option 2: YouTube Unlisted + Custom Page
- Free
- Record video
- Upload to YouTube (unlisted)
- Embed on custom page
- Track with Google Analytics

### Option 3: Loom + Custom Scheduling
- Record with Loom
- Embed on page
- Manual scheduling
- Cheaper alternative

## Support

GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
