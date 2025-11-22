#!/usr/bin/env python3
"""
WAAS 2.0 - Automated Invoice Generator
=======================================

Automatically generates and sends invoices when sellers subscribe.

Features:
- PDF invoice generation
- Automatic invoice numbering
- Email delivery
- Storage in cloud (S3/Google Cloud)
- Integration with accounting software

Flow:
1. Payment webhook received (Stripe/PayPal)
2. Generate invoice PDF
3. Store in cloud storage
4. Send to customer via email
5. Log in accounting system
6. Update CRM with invoice details
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Optional
import logging

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

# Email
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

# Cloud storage
import boto3  # AWS S3

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
COMPANY_NAME = os.getenv('COMPANY_NAME', 'WAAS (WordPress Affiliate Automation System)')
COMPANY_ADDRESS = os.getenv('COMPANY_ADDRESS', 'ul. Przykładowa 123\n00-001 Warszawa\nPoland')
COMPANY_TAX_ID = os.getenv('COMPANY_TAX_ID', 'PL1234567890')
COMPANY_EMAIL = os.getenv('COMPANY_EMAIL', 'billing@waas.com')
COMPANY_PHONE = os.getenv('COMPANY_PHONE', '+48 123 456 789')

# Email configuration
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')

# S3 configuration
AWS_ACCESS_KEY = os.getenv('AWS_ACCESS_KEY')
AWS_SECRET_KEY = os.getenv('AWS_SECRET_KEY')
AWS_BUCKET = os.getenv('AWS_BUCKET', 'waas-invoices')
AWS_REGION = os.getenv('AWS_REGION', 'eu-central-1')


class InvoiceGenerator:
    """Automated invoice generation and delivery"""

    def __init__(self):
        self.s3_client = None
        if AWS_ACCESS_KEY and AWS_SECRET_KEY:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY,
                aws_secret_access_key=AWS_SECRET_KEY,
                region_name=AWS_REGION
            )

    def generate_invoice_number(self, payment_data: Dict) -> str:
        """Generate unique invoice number"""
        # Format: INV-YYYY-MM-XXXX
        # Example: INV-2025-11-0001

        now = datetime.utcnow()
        year = now.strftime('%Y')
        month = now.strftime('%m')

        # Get sequence number from database/file
        # For now, use timestamp
        sequence = now.strftime('%H%M%S')

        return f"INV-{year}-{month}-{sequence}"

    def generate_invoice_pdf(self, invoice_data: Dict) -> str:
        """Generate invoice PDF"""
        try:
            # File path
            invoice_number = invoice_data['invoice_number']
            filename = f"invoice_{invoice_number}.pdf"
            filepath = f"/tmp/{filename}"

            # Create PDF
            doc = SimpleDocTemplate(filepath, pagesize=A4)
            story = []
            styles = getSampleStyleSheet()

            # Title style
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#2C3E50'),
                spaceAfter=30,
                alignment=TA_CENTER
            )

            # Company header
            story.append(Paragraph(COMPANY_NAME, title_style))
            story.append(Spacer(1, 12))

            # Invoice details table
            details_data = [
                ['Invoice Number:', invoice_number],
                ['Invoice Date:', invoice_data['date']],
                ['Payment Method:', invoice_data['payment_method']],
                ['Transaction ID:', invoice_data['transaction_id']],
            ]

            details_table = Table(details_data, colWidths=[100*mm, 60*mm])
            details_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))

            story.append(details_table)
            story.append(Spacer(1, 20))

            # Seller/Customer information
            story.append(Paragraph('<b>Bill To:</b>', styles['Heading2']))
            customer_info = f"""
            <b>{invoice_data['customer_name']}</b><br/>
            {invoice_data.get('customer_address', '')}<br/>
            Email: {invoice_data['customer_email']}<br/>
            {f"Tax ID: {invoice_data.get('customer_tax_id', '')}" if invoice_data.get('customer_tax_id') else ''}
            """
            story.append(Paragraph(customer_info, styles['Normal']))
            story.append(Spacer(1, 20))

            # Items table
            story.append(Paragraph('<b>Items:</b>', styles['Heading2']))

            items_data = [
                ['Description', 'Period', 'Quantity', 'Unit Price', 'Total'],
            ]

            for item in invoice_data['items']:
                items_data.append([
                    item['description'],
                    item.get('period', '-'),
                    str(item['quantity']),
                    f"€{item['unit_price']:.2f}",
                    f"€{item['total']:.2f}"
                ])

            # Subtotal, tax, total
            items_data.append(['', '', '', 'Subtotal:', f"€{invoice_data['subtotal']:.2f}"])

            if invoice_data.get('tax_rate', 0) > 0:
                tax_amount = invoice_data['subtotal'] * invoice_data['tax_rate']
                items_data.append(['', '', '', f"VAT ({invoice_data['tax_rate']*100}%):", f"€{tax_amount:.2f}"])

            items_data.append(['', '', '', '<b>Total:</b>', f"<b>€{invoice_data['total']:.2f}</b>"])

            items_table = Table(items_data, colWidths=[80*mm, 30*mm, 20*mm, 30*mm, 30*mm])
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498DB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -4), 1, colors.grey),
                ('LINEBELOW', (0, -3), (-1, -3), 1, colors.grey),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ]))

            story.append(items_table)
            story.append(Spacer(1, 20))

            # Payment information
            payment_info = f"""
            <b>Payment Information:</b><br/>
            Status: <b>PAID</b><br/>
            Payment Date: {invoice_data['payment_date']}<br/>
            Payment Method: {invoice_data['payment_method']}<br/>
            """
            story.append(Paragraph(payment_info, styles['Normal']))
            story.append(Spacer(1, 20))

            # Footer
            footer = f"""
            <b>{COMPANY_NAME}</b><br/>
            {COMPANY_ADDRESS.replace(chr(10), '<br/>')}<br/>
            Tax ID: {COMPANY_TAX_ID}<br/>
            Email: {COMPANY_EMAIL}<br/>
            Phone: {COMPANY_PHONE}
            """
            story.append(Paragraph(footer, styles['Normal']))

            # Build PDF
            doc.build(story)

            logger.info(f"Invoice PDF generated: {filepath}")

            return filepath

        except Exception as e:
            logger.error(f"Error generating invoice PDF: {e}")
            raise

    def upload_to_s3(self, filepath: str, invoice_number: str) -> Optional[str]:
        """Upload invoice to S3"""
        try:
            if not self.s3_client:
                logger.warning("S3 not configured, skipping upload")
                return None

            filename = f"invoices/{invoice_number}.pdf"

            self.s3_client.upload_file(
                filepath,
                AWS_BUCKET,
                filename,
                ExtraArgs={'ContentType': 'application/pdf'}
            )

            # Generate public URL (expires in 7 days)
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': AWS_BUCKET, 'Key': filename},
                ExpiresIn=604800  # 7 days
            )

            logger.info(f"Invoice uploaded to S3: {filename}")

            return url

        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            return None

    def send_invoice_email(self, recipient_email: str, invoice_data: Dict, pdf_path: str) -> bool:
        """Send invoice via email"""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = SMTP_USER
            msg['To'] = recipient_email
            msg['Subject'] = f"Invoice {invoice_data['invoice_number']} - WAAS Patronage"

            # Email body
            body = f"""
Dear {invoice_data['customer_name']},

Thank you for your payment!

Please find attached your invoice for the WAAS Patronage subscription.

Invoice Details:
- Invoice Number: {invoice_data['invoice_number']}
- Amount: €{invoice_data['total']:.2f}
- Payment Date: {invoice_data['payment_date']}
- Status: PAID

Your patronage is now active! You should see your branding on the website within a few minutes.

If you have any questions, please don't hesitate to reach out.

Best regards,
WAAS Team

---
{COMPANY_NAME}
{COMPANY_EMAIL}
            """

            msg.attach(MIMEText(body, 'plain'))

            # Attach PDF
            with open(pdf_path, 'rb') as f:
                pdf_attachment = MIMEApplication(f.read(), _subtype='pdf')
                pdf_attachment.add_header(
                    'Content-Disposition',
                    'attachment',
                    filename=f"invoice_{invoice_data['invoice_number']}.pdf"
                )
                msg.attach(pdf_attachment)

            # Send email
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"Invoice email sent to {recipient_email}")

            return True

        except Exception as e:
            logger.error(f"Error sending invoice email: {e}")
            return False

    def create_invoice_from_payment(self, payment_data: Dict) -> Dict:
        """Create invoice from payment webhook data"""
        try:
            # Generate invoice number
            invoice_number = self.generate_invoice_number(payment_data)

            # Prepare invoice data
            invoice_data = {
                'invoice_number': invoice_number,
                'date': datetime.utcnow().strftime('%Y-%m-%d'),
                'payment_date': payment_data.get('payment_date', datetime.utcnow().strftime('%Y-%m-%d')),
                'payment_method': payment_data.get('payment_method', 'Stripe'),
                'transaction_id': payment_data.get('transaction_id', ''),
                'customer_name': payment_data.get('brand_name', payment_data.get('customer_name', 'Seller')),
                'customer_email': payment_data.get('email'),
                'customer_address': payment_data.get('address', ''),
                'customer_tax_id': payment_data.get('tax_id', ''),
                'items': [],
                'subtotal': 0,
                'tax_rate': 0,  # Adjust based on customer location
                'total': 0
            }

            # Add subscription item
            amount = payment_data.get('amount', 50)
            subscription_type = payment_data.get('subscription_type', 'monthly')

            item = {
                'description': f'WAAS Patronage Subscription ({subscription_type.capitalize()})',
                'period': self._get_subscription_period(subscription_type),
                'quantity': 1,
                'unit_price': amount,
                'total': amount
            }

            invoice_data['items'].append(item)
            invoice_data['subtotal'] = amount
            invoice_data['total'] = amount

            # Generate PDF
            pdf_path = self.generate_invoice_pdf(invoice_data)

            # Upload to S3
            s3_url = self.upload_to_s3(pdf_path, invoice_number)

            # Send email
            self.send_invoice_email(invoice_data['customer_email'], invoice_data, pdf_path)

            return {
                'success': True,
                'invoice_number': invoice_number,
                'pdf_path': pdf_path,
                's3_url': s3_url
            }

        except Exception as e:
            logger.error(f"Error creating invoice: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_subscription_period(self, subscription_type: str) -> str:
        """Get human-readable subscription period"""
        now = datetime.utcnow()

        if subscription_type == 'monthly':
            return f"{now.strftime('%B %Y')}"
        elif subscription_type == 'yearly':
            next_year = now.year + 1
            return f"{now.strftime('%B %Y')} - {now.strftime('%B')} {next_year}"
        else:
            return "-"


# Flask API
from flask import Flask, request, jsonify

app = Flask(__name__)
invoice_generator = InvoiceGenerator()


@app.route('/api/generate-invoice', methods=['POST'])
def generate_invoice():
    """API endpoint to generate invoice"""
    try:
        payment_data = request.json

        result = invoice_generator.create_invoice_from_payment(payment_data)

        return jsonify(result), 200 if result['success'] else 500

    except Exception as e:
        logger.error(f"Error in API: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'invoice-generator',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5005))
    app.run(host='0.0.0.0', port=port, debug=False)
