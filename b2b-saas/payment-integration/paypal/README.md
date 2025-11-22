# WAAS 2.0 - PayPal Payment Integration

PayPal webhook handler for automatic patronage activation when sellers subscribe.

## Features

✅ **Automatic Patronage Activation** - Activates patronage on payment
✅ **Webhook Signature Verification** - Secure webhook handling via PayPal API
✅ **Subscription Support** - Handles recurring subscriptions
✅ **One-time Payments** - Support for single payments
✅ **Refund Handling** - Automatic deactivation on refund
✅ **Multi-Mode** - Sandbox and Live mode support

## Supported PayPal Events

| Event | Action |
|-------|--------|
| `PAYMENT.SALE.COMPLETED` | Activate patronage on payment |
| `BILLING.SUBSCRIPTION.ACTIVATED` | Activate patronage on subscription |
| `BILLING.SUBSCRIPTION.CANCELLED` | Deactivate patronage |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Deactivate patronage |
| `PAYMENT.SALE.REFUNDED` | Deactivate patronage |

## Installation

### 1. Install Dependencies

```bash
cd b2b-saas/payment-integration/paypal
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

### 3. Run Locally

```bash
python webhook_handler.py
```

### 4. Run in Production

```bash
gunicorn -w 4 -b 0.0.0.0:5001 webhook_handler:app
```

## PayPal Dashboard Setup

### 1. Create App

1. Go to https://developer.paypal.com/dashboard
2. **My Apps & Credentials** → **Create App**
3. App Name: "WAAS Patronage"
4. Copy **Client ID** and **Secret** to `.env`

### 2. Configure Webhooks

1. In your app → **Webhooks** → **Add Webhook**
2. Webhook URL: `https://your-domain.com/webhook`
3. Events:
   - `PAYMENT.SALE.COMPLETED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `PAYMENT.SALE.REFUNDED`
4. Copy **Webhook ID** to `.env` as `PAYPAL_WEBHOOK_ID`

### 3. Create Payment Button

When creating PayPal button, pass seller data in `custom_id`:

```
seller_id|brand_name|logo_url|email|phone|website|brand_story
```

Example:
```
AMZN-SELLER-123|Example Brand|https://example.com/logo.png|contact@example.com|+49123456789|https://example.com|Our story...
```

## Testing

### Sandbox Testing

1. Use sandbox credentials in `.env`
2. Test with PayPal sandbox account
3. Monitor webhooks in PayPal Developer Dashboard

### Live Testing

1. Switch to live credentials
2. Set `PAYPAL_MODE=live`
3. Test with real PayPal account (small amount)

## Support

GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
