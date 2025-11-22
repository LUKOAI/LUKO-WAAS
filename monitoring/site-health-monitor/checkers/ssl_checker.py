#!/usr/bin/env python3
"""
SSL Certificate Checker
========================

Checks SSL certificate validity and expiration.
"""

import ssl
import socket
from datetime import datetime, timedelta
from typing import Dict
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class SSLChecker:
    """Checks SSL certificate"""

    def check(self, url: str) -> Dict:
        """
        Check SSL certificate

        Returns:
            {
                'valid': bool,
                'expires': datetime,
                'days_remaining': int,
                'expires_soon': bool,  # < 30 days
                'issuer': str,
                'error': str
            }
        """
        try:
            # Parse hostname
            parsed = urlparse(url)
            hostname = parsed.netloc or parsed.path

            # Remove port if present
            if ':' in hostname:
                hostname = hostname.split(':')[0]

            # Get certificate
            context = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()

            # Parse expiration date
            expires_str = cert['notAfter']
            expires = datetime.strptime(expires_str, '%b %d %H:%M:%S %Y %Z')

            # Calculate days remaining
            days_remaining = (expires - datetime.utcnow()).days

            # Check if expires soon (< 30 days)
            expires_soon = days_remaining < 30

            # Get issuer
            issuer = dict(x[0] for x in cert['issuer'])
            issuer_name = issuer.get('organizationName', 'Unknown')

            return {
                'valid': True,
                'expires': expires.isoformat(),
                'days_remaining': days_remaining,
                'expires_soon': expires_soon,
                'issuer': issuer_name,
                'error': None
            }

        except ssl.SSLError as e:
            logger.error(f"SSL error for {url}: {e}")
            return {
                'valid': False,
                'expires': None,
                'days_remaining': 0,
                'expires_soon': True,
                'issuer': None,
                'error': f"SSL Error: {str(e)}"
            }

        except socket.timeout:
            logger.error(f"SSL check timeout for {url}")
            return {
                'valid': False,
                'expires': None,
                'days_remaining': 0,
                'expires_soon': True,
                'issuer': None,
                'error': "Timeout"
            }

        except Exception as e:
            logger.error(f"Error checking SSL for {url}: {e}")
            return {
                'valid': False,
                'expires': None,
                'days_remaining': 0,
                'expires_soon': True,
                'issuer': None,
                'error': str(e)
            }
