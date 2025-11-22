#!/usr/bin/env python3
"""
Performance Checker
===================

Checks site performance (response time, page size, etc.).
"""

import aiohttp
import time
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class PerformanceChecker:
    """Checks site performance"""

    async def check(self, url: str) -> Dict:
        """
        Check site performance

        Returns:
            {
                'response_time_ms': int,
                'page_size_kb': float,
                'status': str  # fast, moderate, slow
            }
        """
        try:
            start_time = time.time()

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=30) as response:
                    content = await response.read()

                    end_time = time.time()

                    # Calculate metrics
                    response_time_ms = int((end_time - start_time) * 1000)
                    page_size_kb = len(content) / 1024

                    # Determine status
                    if response_time_ms < 1000:
                        status = 'fast'
                    elif response_time_ms < 3000:
                        status = 'moderate'
                    else:
                        status = 'slow'

                    return {
                        'response_time_ms': response_time_ms,
                        'page_size_kb': round(page_size_kb, 2),
                        'status': status
                    }

        except Exception as e:
            logger.error(f"Performance check failed for {url}: {e}")
            return {
                'response_time_ms': 0,
                'page_size_kb': 0,
                'status': 'error'
            }
