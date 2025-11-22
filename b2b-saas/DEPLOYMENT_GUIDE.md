# WAAS 2.0 - B2B SaaS Deployment Guide

Quick deployment guide for all FAZA 3 components.

## Quick Start (5 Minutes)

### 1. Clone and Install

```bash
git clone https://github.com/LUKOAI/LUKO-WAAS.git
cd LUKO-WAAS/b2b-saas
```

### 2. Configure All Services

```bash
# Run configuration script
./scripts/configure-all.sh
```

Or manually:

```bash
# Configure each service
for dir in payment-integration/stripe payment-integration/paypal sales-funnel/ai-calling sales-funnel/everwebinar invoice-generator onboarding-automation; do
    cd $dir
    cp .env.example .env
    nano .env  # Fill in your credentials
    cd -
done
```

### 3. Deploy with Docker Compose

```bash
docker-compose up -d
```

Services will be available at:
- Stripe Webhook: http://localhost:5000
- PayPal Webhook: http://localhost:5001
- AI Calling: http://localhost:5002
- EverWebinar: http://localhost:5004
- Invoice Generator: http://localhost:5005
- Onboarding: http://localhost:5006

## Production Deployment

### Google Cloud Run

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Login
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Deploy all services
./scripts/deploy-gcloud.sh
```

### AWS Elastic Container Service

```bash
# Install AWS CLI
pip install awscli

# Configure
aws configure

# Deploy
./scripts/deploy-aws.sh
```

## Webhook URLs Setup

After deployment, configure webhooks:

### Stripe
1. https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-domain.com/webhook`
3. Select events: `checkout.session.completed`, `invoice.payment_succeeded`, etc.
4. Copy signing secret to `.env`

### PayPal
1. https://developer.paypal.com
2. Your app → Webhooks
3. Add: `https://your-domain.com/webhook`
4. Events: `PAYMENT.SALE.COMPLETED`, etc.

### Vapi.ai
1. https://vapi.ai/dashboard
2. Webhooks → Add
3. URL: `https://your-domain.com/webhook/vapi/call-completed`

### Bland.ai
1. https://bland.ai/settings
2. Webhooks → Add
3. URL: `https://your-domain.com/webhook/bland/call-completed`

### EverWebinar
1. https://everwebinar.com
2. Your webinar → Integrations → Webhooks
3. URL: `https://your-domain.com/webhook/everwebinar/attended`

## Testing

```bash
# Test all health endpoints
./scripts/test-health.sh

# Expected output:
# ✅ Stripe webhook: healthy
# ✅ PayPal webhook: healthy
# ✅ AI calling: healthy
# ✅ EverWebinar: healthy
# ✅ Invoice generator: healthy
# ✅ Onboarding: healthy
```

## Monitoring

### Set up alerts

```bash
# Google Cloud Monitoring
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL \
  --display-name="WAAS Services Health" \
  --condition-display-name="Service Down" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=60s
```

## Troubleshooting

### Services not starting?

```bash
# Check logs
docker-compose logs stripe-webhook
docker-compose logs paypal-webhook

# Or for Cloud Run
gcloud logging read "resource.type=cloud_run_revision"
```

### Webhooks not receiving events?

1. Check webhook URL is publicly accessible
2. Verify SSL certificate is valid
3. Check signature verification is correct
4. Review provider webhook logs

## Scaling

### Horizontal Scaling

```bash
# Google Cloud Run (auto-scales)
gcloud run services update waas-stripe-webhook \
  --min-instances=1 \
  --max-instances=10

# Docker (manual scaling)
docker-compose up --scale stripe-webhook=3
```

## Support

- GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
- Email: support@waas.com
