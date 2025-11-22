# WAAS 2.0 - Automated Invoice Generator

Automatically generates and sends invoices when sellers subscribe.

## Features

✅ **PDF Generation** - Professional invoice PDFs with reportlab
✅ **Automatic Numbering** - Sequential invoice numbers
✅ **Email Delivery** - Sends invoice to customer automatically
✅ **Cloud Storage** - Stores invoices in AWS S3
✅ **Customizable** - Company logo, colors, layout

## Installation

```bash
cd b2b-saas/invoice-generator
pip install -r requirements.txt
```

## Configuration

```bash
cp .env.example .env
nano .env
```

Update with your company details and SMTP/S3 credentials.

## Usage

### Generate Invoice from Payment Data

```python
from invoice_generator import InvoiceGenerator

generator = InvoiceGenerator()

payment_data = {
    'amount': 50,
    'currency': 'EUR',
    'email': 'seller@example.com',
    'brand_name': 'Example Brand',
    'payment_method': 'Stripe',
    'transaction_id': 'pi_xxxxx',
    'subscription_type': 'monthly',
    'payment_date': '2025-11-22'
}

result = generator.create_invoice_from_payment(payment_data)
print(result)
# {
#   'success': True,
#   'invoice_number': 'INV-2025-11-0001',
#   'pdf_path': '/tmp/invoice_INV-2025-11-0001.pdf',
#   's3_url': 'https://s3.amazonaws.com/...'
# }
```

### API Endpoint

```bash
curl -X POST https://your-domain.com/api/generate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "email": "seller@example.com",
    "brand_name": "Example Brand",
    "payment_method": "Stripe",
    "transaction_id": "pi_xxxxx"
  }'
```

## Invoice Format

Generated invoices include:
- Company header
- Invoice number and date
- Customer details
- Itemized list
- Subtotal, tax, total
- Payment information (PAID status)
- Company footer

## Integration

### With Stripe Webhook

```python
# In stripe webhook handler
if event_type == 'payment_succeeded':
    # Generate invoice
    from invoice_generator import InvoiceGenerator

    generator = InvoiceGenerator()
    invoice = generator.create_invoice_from_payment({
        'amount': payment_data['amount'],
        'email': payment_data['email'],
        'brand_name': payment_data['brand_name'],
        'payment_method': 'Stripe',
        'transaction_id': payment_data['payment_id']
    })
```

## Email Configuration

### Gmail Setup

1. Enable 2-factor authentication
2. Generate app password
3. Use app password in `.env`

### SendGrid Setup

Alternative to SMTP - use SendGrid API:

```python
import sendgrid
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

# Install: pip install sendgrid

sg = sendgrid.SendGridAPIClient(api_key=os.getenv('SENDGRID_API_KEY'))

message = Mail(
    from_email='billing@waas.com',
    to_emails=recipient_email,
    subject=f'Invoice {invoice_number}',
    html_content=email_body
)

# Attach PDF
with open(pdf_path, 'rb') as f:
    data = f.read()
    encoded = base64.b64encode(data).decode()

attachment = Attachment()
attachment.file_content = FileContent(encoded)
attachment.file_type = FileType('application/pdf')
attachment.file_name = FileName(f'invoice_{invoice_number}.pdf')
attachment.disposition = Disposition('attachment')
message.attachment = attachment

response = sg.send(message)
```

## S3 Storage

### Setup

1. Create S3 bucket: `waas-invoices`
2. Create IAM user with S3 permissions
3. Add credentials to `.env`

### Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::waas-invoices/*",
      "Condition": {
        "StringLike": {
          "aws:Referer": "https://yoursite.com/*"
        }
      }
    }
  ]
}
```

## Customization

### Add Company Logo

```python
from reportlab.lib.utils import ImageReader

# In generate_invoice_pdf()
logo = ImageReader('path/to/logo.png')
story.append(Image(logo, width=100, height=40))
```

### Change Colors

```python
# Header color
colors.HexColor('#3498DB')  # Blue

# Change to your brand color
colors.HexColor('#FF5733')  # Orange
```

## Accounting Integration

### QuickBooks

```python
from quickbooks import QuickBooks

qb = QuickBooks(
    client_id=os.getenv('QB_CLIENT_ID'),
    client_secret=os.getenv('QB_CLIENT_SECRET')
)

# Create invoice in QuickBooks
qb_invoice = qb.create_invoice({
    'customer': customer_id,
    'amount': invoice_data['total'],
    'invoice_number': invoice_number
})
```

### Xero

```python
from xero import Xero

xero = Xero(credentials)

# Create invoice in Xero
xero_invoice = xero.invoices.put({
    'Type': 'ACCREC',
    'Contact': {'Name': customer_name},
    'LineItems': [...]
})
```

## Support

GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
