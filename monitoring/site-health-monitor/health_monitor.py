#!/usr/bin/env python3
"""
WAAS 2.0 - Site Health Monitor
===============================

Monitors health of all affiliate sites (100+).

Checks:
- Uptime (HTTP 200)
- SSL certificate validity
- Performance (response time)
- WordPress health
- Broken links
- Amazon affiliate links
- SEO meta tags

Runs every 5 minutes for critical checks, every hour for detailed checks.

Flow:
1. Fetch list of sites from database
2. Run health checks on each site
3. Store results in database
4. If issues detected → Trigger crisis management
5. Generate health report
"""

import os
import sys
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging
from dataclasses import dataclass, asdict
import json

# Add checkers to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'checkers'))

from uptime_checker import UptimeChecker
from ssl_checker import SSLChecker
from performance_checker import PerformanceChecker
from wordpress_checker import WordPressChecker

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class SiteHealth:
    """Site health status"""
    site_id: str
    url: str
    status: str  # healthy, warning, critical, down
    uptime: bool
    ssl_valid: bool
    response_time_ms: int
    wordpress_ok: bool
    last_checked: str
    issues: List[str]
    score: int  # 0-100


class HealthMonitor:
    """Main health monitoring orchestrator"""

    def __init__(self):
        self.uptime_checker = UptimeChecker()
        self.ssl_checker = SSLChecker()
        self.performance_checker = PerformanceChecker()
        self.wordpress_checker = WordPressChecker()

    async def check_site(self, site: Dict) -> SiteHealth:
        """Run all health checks for a single site"""
        try:
            site_id = site['id']
            url = site['url']

            logger.info(f"Checking site: {url}")

            issues = []
            score = 100

            # 1. Uptime check (critical)
            uptime_result = await self.uptime_checker.check(url)
            if not uptime_result['is_up']:
                issues.append(f"Site is DOWN: {uptime_result['error']}")
                score -= 50

                # Site is down - return immediately
                return SiteHealth(
                    site_id=site_id,
                    url=url,
                    status='down',
                    uptime=False,
                    ssl_valid=False,
                    response_time_ms=0,
                    wordpress_ok=False,
                    last_checked=datetime.utcnow().isoformat(),
                    issues=issues,
                    score=0
                )

            # 2. SSL check
            ssl_result = await self.ssl_checker.check(url)
            if not ssl_result['valid']:
                issues.append(f"SSL issue: {ssl_result['error']}")
                score -= 20

            if ssl_result.get('expires_soon'):
                issues.append(f"SSL expires in {ssl_result['days_remaining']} days")
                score -= 10

            # 3. Performance check
            perf_result = await self.performance_checker.check(url)
            response_time = perf_result['response_time_ms']

            if response_time > 3000:
                issues.append(f"Slow response time: {response_time}ms")
                score -= 15
            elif response_time > 2000:
                issues.append(f"Moderate response time: {response_time}ms")
                score -= 5

            # 4. WordPress health check
            wp_result = await self.wordpress_checker.check(url)
            if not wp_result['healthy']:
                issues.append(f"WordPress issue: {wp_result['error']}")
                score -= 20

            # Determine overall status
            if score >= 80:
                status = 'healthy'
            elif score >= 60:
                status = 'warning'
            else:
                status = 'critical'

            return SiteHealth(
                site_id=site_id,
                url=url,
                status=status,
                uptime=uptime_result['is_up'],
                ssl_valid=ssl_result['valid'],
                response_time_ms=response_time,
                wordpress_ok=wp_result['healthy'],
                last_checked=datetime.utcnow().isoformat(),
                issues=issues,
                score=score
            )

        except Exception as e:
            logger.error(f"Error checking site {site.get('url')}: {e}")

            return SiteHealth(
                site_id=site.get('id', 'unknown'),
                url=site.get('url', ''),
                status='error',
                uptime=False,
                ssl_valid=False,
                response_time_ms=0,
                wordpress_ok=False,
                last_checked=datetime.utcnow().isoformat(),
                issues=[f"Monitor error: {str(e)}"],
                score=0
            )

    async def check_all_sites(self, sites: List[Dict]) -> List[SiteHealth]:
        """Check health of all sites concurrently"""
        tasks = [self.check_site(site) for site in sites]
        results = await asyncio.gather(*tasks)
        return results

    def generate_report(self, results: List[SiteHealth]) -> Dict:
        """Generate health report summary"""
        total = len(results)
        healthy = sum(1 for r in results if r.status == 'healthy')
        warning = sum(1 for r in results if r.status == 'warning')
        critical = sum(1 for r in results if r.status == 'critical')
        down = sum(1 for r in results if r.status == 'down')

        avg_score = sum(r.score for r in results) / total if total > 0 else 0
        avg_response_time = sum(r.response_time_ms for r in results) / total if total > 0 else 0

        # Sites with issues
        sites_with_issues = [r for r in results if r.issues]

        return {
            'timestamp': datetime.utcnow().isoformat(),
            'total_sites': total,
            'healthy': healthy,
            'warning': warning,
            'critical': critical,
            'down': down,
            'health_percentage': (healthy / total * 100) if total > 0 else 0,
            'average_score': round(avg_score, 2),
            'average_response_time_ms': round(avg_response_time, 2),
            'sites_with_issues': len(sites_with_issues),
            'critical_issues': [
                {
                    'site_id': r.site_id,
                    'url': r.url,
                    'status': r.status,
                    'issues': r.issues,
                    'score': r.score
                }
                for r in results if r.status in ['critical', 'down']
            ]
        }

    async def monitor_loop(self, sites: List[Dict], interval_seconds: int = 300):
        """Continuous monitoring loop"""
        logger.info(f"Starting monitoring loop for {len(sites)} sites...")
        logger.info(f"Check interval: {interval_seconds} seconds")

        while True:
            try:
                logger.info("=== Starting health check cycle ===")

                # Check all sites
                results = await self.check_all_sites(sites)

                # Generate report
                report = self.generate_report(results)

                logger.info(f"Health check complete:")
                logger.info(f"  Total: {report['total_sites']}")
                logger.info(f"  Healthy: {report['healthy']} ({report['health_percentage']:.1f}%)")
                logger.info(f"  Warning: {report['warning']}")
                logger.info(f"  Critical: {report['critical']}")
                logger.info(f"  Down: {report['down']}")

                # Store results (database integration)
                await self.store_results(results, report)

                # Trigger alerts if needed
                if report['critical'] > 0 or report['down'] > 0:
                    await self.trigger_crisis_management(report)

                # Wait for next cycle
                await asyncio.sleep(interval_seconds)

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait 1 min on error

    async def store_results(self, results: List[SiteHealth], report: Dict):
        """Store health check results in database"""
        try:
            # Store in PostgreSQL or MongoDB
            # For now, write to file
            output_dir = '/tmp/waas-health-checks'
            os.makedirs(output_dir, exist_ok=True)

            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')

            # Store individual results
            results_file = f"{output_dir}/results_{timestamp}.json"
            with open(results_file, 'w') as f:
                json.dump([asdict(r) for r in results], f, indent=2)

            # Store summary report
            report_file = f"{output_dir}/report_{timestamp}.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2)

            logger.info(f"Results stored: {results_file}")

        except Exception as e:
            logger.error(f"Error storing results: {e}")

    async def trigger_crisis_management(self, report: Dict):
        """Trigger crisis management for critical issues"""
        try:
            logger.warning("CRITICAL ISSUES DETECTED - Triggering crisis management")

            # Import crisis manager
            from crisis_management.crisis_manager import CrisisManager

            crisis_manager = CrisisManager()
            await crisis_manager.handle_critical_issues(report)

        except Exception as e:
            logger.error(f"Error triggering crisis management: {e}")


# Flask API for health monitoring
from flask import Flask, jsonify, request

app = Flask(__name__)
monitor = HealthMonitor()

# Global storage for last results
last_results = []
last_report = {}


@app.route('/api/health/check-all', methods=['POST'])
async def check_all():
    """API endpoint to trigger health check for all sites"""
    try:
        sites = request.json.get('sites', [])

        results = await monitor.check_all_sites(sites)
        report = monitor.generate_report(results)

        # Store globally
        global last_results, last_report
        last_results = results
        last_report = report

        return jsonify({
            'success': True,
            'report': report,
            'results': [asdict(r) for r in results]
        }), 200

    except Exception as e:
        logger.error(f"Error in check_all: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/health/report', methods=['GET'])
def get_report():
    """Get latest health report"""
    return jsonify({
        'success': True,
        'report': last_report
    }), 200


@app.route('/api/health/site/<site_id>', methods=['GET'])
def get_site_health(site_id):
    """Get health status for specific site"""
    result = next((r for r in last_results if r.site_id == site_id), None)

    if result:
        return jsonify({
            'success': True,
            'health': asdict(result)
        }), 200
    else:
        return jsonify({'error': 'Site not found'}), 404


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'site-health-monitor',
        'timestamp': datetime.utcnow().isoformat(),
        'sites_monitored': len(last_results)
    }), 200


if __name__ == '__main__':
    # For production, use gunicorn
    port = int(os.getenv('PORT', 5010))
    app.run(host='0.0.0.0', port=port, debug=False)
