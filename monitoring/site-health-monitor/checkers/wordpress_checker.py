#!/usr/bin/env python3
"""
WordPress Health Checker
=========================

Checks WordPress-specific health indicators.
"""

import aiohttp
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class WordPressChecker:
    """Checks WordPress health"""

    async def check(self, url: str) -> Dict:
        """
        Check WordPress health

        Checks:
        - WordPress REST API availability
        - Plugin/theme errors
        - Database connection
        - PHP errors in response

        Returns:
            {
                'healthy': bool,
                'rest_api_ok': bool,
                'has_errors': bool,
                'error': str
            }
        """
        try:
            rest_api_ok = await self.check_rest_api(url)
            has_php_errors = await self.check_for_php_errors(url)

            healthy = rest_api_ok and not has_php_errors

            return {
                'healthy': healthy,
                'rest_api_ok': rest_api_ok,
                'has_errors': has_php_errors,
                'error': None if healthy else 'WordPress health check failed'
            }

        except Exception as e:
            logger.error(f"WordPress check failed for {url}: {e}")
            return {
                'healthy': False,
                'rest_api_ok': False,
                'has_errors': True,
                'error': str(e)
            }

    async def check_rest_api(self, url: str) -> bool:
        """Check if WordPress REST API is accessible"""
        try:
            # Remove trailing slash
            base_url = url.rstrip('/')

            # Try WordPress REST API
            api_url = f"{base_url}/wp-json/"

            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        # Check if it's a valid WP REST API response
                        return 'namespace' in data or 'routes' in data
                    return False

        except Exception as e:
            logger.debug(f"REST API check failed for {url}: {e}")
            return False

    async def check_for_php_errors(self, url: str) -> bool:
        """Check if page contains PHP errors or warnings"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    html = await response.text()

                    # Common PHP error indicators
                    error_indicators = [
                        'Fatal error:',
                        'Warning:',
                        'Parse error:',
                        'Notice:',
                        'Deprecated:',
                        'Database connection error',
                        'Error establishing a database connection',
                        '<?php',  # Exposed PHP code
                    ]

                    for indicator in error_indicators:
                        if indicator in html:
                            logger.warning(f"PHP error detected on {url}: {indicator}")
                            return True

                    return False

        except Exception as e:
            logger.debug(f"PHP error check failed for {url}: {e}")
            return False
