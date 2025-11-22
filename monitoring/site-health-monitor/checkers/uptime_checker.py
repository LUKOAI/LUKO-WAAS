#!/usr/bin/env python3
"""
Uptime Checker
==============

Checks if site is up and responding with HTTP 200.
"""

import aiohttp
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class UptimeChecker:
    """Checks site uptime"""

    async def check(self, url: str, timeout: int = 10) -> Dict:
        """
        Check if site is up

        Returns:
            {
                'is_up': bool,
                'status_code': int,
                'error': str
            }
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=timeout, allow_redirects=True) as response:
                    is_up = response.status == 200

                    return {
                        'is_up': is_up,
                        'status_code': response.status,
                        'error': None if is_up else f"HTTP {response.status}"
                    }

        except aiohttp.ClientError as e:
            logger.error(f"Uptime check failed for {url}: {e}")
            return {
                'is_up': False,
                'status_code': 0,
                'error': f"Connection error: {str(e)}"
            }

        except asyncio.TimeoutError:
            logger.error(f"Uptime check timeout for {url}")
            return {
                'is_up': False,
                'status_code': 0,
                'error': "Timeout"
            }

        except Exception as e:
            logger.error(f"Unexpected error checking {url}: {e}")
            return {
                'is_up': False,
                'status_code': 0,
                'error': f"Error: {str(e)}"
            }
