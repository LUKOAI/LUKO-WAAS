# WAAS 2.0 - Stripe Payment Integration

Stripe webhook handler for automatic patronage activation when sellers subscribe.

## Features

✅ **Automatic Patronage Activation** - Activates patronage immediately on payment
✅ **Webhook Signature Verification** - Secure webhook handling
✅ **Subscription Management** - Handles renewals, cancellations, updates
✅ **Invoice Generation** - Automatic invoice creation
✅ **Onboarding Automation** - Automatic welcome emails
✅ **Multi-Event Support** - Handles all Stripe subscription events

## Supported Stripe Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate patronage on first payment |
| `invoice.payment_succeeded` | Renew patronage on recurring payment |
| `customer.subscription.deleted` | Deactivate patronage |
| `customer.subscription.updated` | Handle plan changes |

## Installation

### 1. Install Dependencies

```bash
cd b2b-saas/payment-integration/stripe
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in your Stripe and WordPress credentials:

```env
STRIPE_API_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
WORDPRESS_API_URL=https://yoursite.com/wp-json/waas/v1
WORDPRESS_API_KEY=your-api-key
```

### 3. Run Locally (Development)

```bash
python webhook_handler.py
```

Server will start on `http://localhost:5000`

### 4. Run in Production (Gunicorn)

```bash
gunicorn -w 4 -b 0.0.0.0:5000 webhook_handler:app
```

### 5. Deploy (Recommended: Google Cloud Run)

```bash
# Build Docker image
docker build -t waas-stripe-webhook .

# Deploy to Cloud Run
gcloud run deploy waas-stripe-webhook \
  --image gcr.io/your-project/waas-stripe-webhook \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

## Stripe Dashboard Setup

### 1. Create Products

In Stripe Dashboard → **Products**, create:

**Monthly Subscription:**
- Name: "WAAS Patronage - Monthly"
- Price: €50/month
- Recurring: Monthly
- Product ID: `prod_monthly_patronage`

**Yearly Subscription:**
- Name: "WAAS Patronage - Yearly"
- Price: €400/year
- Recurring: Yearly
- Product ID: `prod_yearly_patronage`

**Multi-Country:**
- Name: "WAAS Patronage - Multi-Country (3+)"
- Price: €100/month
- Recurring: Monthly
- Product ID: `prod_multi_country`

### 2. Create Checkout Session

When sending sellers to payment page, create a Stripe Checkout session with metadata:

```python
import stripe

session = stripe.checkout.Session.create(
    payment_method_types=['card'],
    mode='subscription',
    line_items=[{
        'price': 'price_xxxxx',  # Price ID from Stripe Dashboard
        'quantity': 1,
    }],
    success_url='https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url='https://yoursite.com/cancel',
    metadata={
        'seller_id': 'AMZN-SELLER-123',
        'brand_name': 'Example Brand',
        'logo_url': 'https://example.com/logo.png',
        'email': 'contact@example.com',
        'phone': '+49 123 456789',
        'website': 'https://example.com',
        'brand_story': 'Our brand story...',
        'subscription_type': 'monthly',  # or 'yearly'
    }
)

# Redirect user to session.url
```

### 3. Configure Webhooks

In Stripe Dashboard → **Developers** → **Webhooks**:

1. Click **Add endpoint**
2. Endpoint URL: `https://your-domain.com/webhook`
3. Events to send:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copy **Signing secret** → Add to `.env` as `STRIPE_WEBHOOK_SECRET`

## Workflow

### New Subscription Flow

```
1. Seller clicks payment link
   ↓
2. Stripe Checkout page opens
   ↓
3. Seller enters payment details
   ↓
4. Payment processed by Stripe
   ↓
5. Stripe sends webhook: checkout.session.completed
   ↓
6. Webhook handler receives event
   ↓
7. Verifies signature
   ↓
8. Extracts seller data from metadata
   ↓
9. Calls WordPress REST API:
   POST /wp-json/waas/v1/patronage/activate
   ↓
10. Patronage activated (logo, contact, exclusive products)
   ↓
11. Invoice generated
   ↓
12. Onboarding email sent
   ↓
13. Seller receives dashboard access
```

### Subscription Renewal Flow

```
1. Stripe charges recurring payment
   ↓
2. Stripe sends webhook: invoice.payment_succeeded
   ↓
3. Webhook handler ensures patronage is active
   ↓
4. Invoice generated
   ↓
5. Email confirmation sent
```

### Cancellation Flow

```
1. Seller cancels subscription
   ↓
2. Stripe sends webhook: customer.subscription.deleted
   ↓
3. Webhook handler deactivates patronage
   ↓
4. Logo, contact info removed from site
   ↓
5. Products revert to multi-product display
   ↓
6. Cancellation email sent
```

## Testing

### Test with Stripe CLI

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:5000/webhook
   ```

4. Trigger test event:
   ```bash
   stripe trigger checkout.session.completed
   ```

### Test Payment Flow

Use Stripe test cards:

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 9995 | Declined |
| 4000 0025 0000 3155 | Requires authentication (3D Secure) |

## Monitoring

### Health Check

```bash
curl https://your-domain.com/health
```

Response:
```json
{
  "status": "healthy",
  "service": "stripe-webhook-handler",
  "timestamp": "2025-11-22T14:30:00Z"
}
```

### Logs

Check application logs:
```bash
tail -f /var/log/waas-stripe-webhook.log
```

### Stripe Dashboard

Monitor webhooks in Stripe Dashboard → **Developers** → **Webhooks** → **Logs**

## Security

✅ **Webhook Signature Verification** - All webhooks verified using Stripe signature
✅ **HTTPS Only** - Webhook endpoint must use HTTPS
✅ **Environment Variables** - Secrets stored in environment, not code
✅ **API Key Authentication** - WordPress API calls authenticated
✅ **Rate Limiting** - Consider adding rate limiting in production

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook URL in Stripe Dashboard
2. Verify endpoint is publicly accessible (use ngrok for local testing)
3. Check firewall allows incoming connections
4. Verify SSL certificate is valid

### Signature Verification Failed

1. Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Ensure webhook payload is passed as raw bytes, not parsed JSON
3. Verify `Stripe-Signature` header is present

### Patronage Not Activating

1. Check WordPress API URL is correct
2. Verify WordPress API key is valid
3. Check WordPress REST API is accessible
4. Review WordPress logs for errors

### Payment Succeeded But Webhook Not Triggered

1. Check webhook is configured in Stripe Dashboard
2. Verify events are selected: `checkout.session.completed`, etc.
3. Check webhook signing secret is correct
4. Review Stripe webhook logs for delivery errors

## Support

For issues or questions:
- GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
- Email: support@luko.ai

## License

GPL v2 or later
