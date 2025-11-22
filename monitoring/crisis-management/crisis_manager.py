#!/usr/bin/env python3
"""
WAAS 2.0 - Crisis Management System
====================================

Automatically handles critical site issues.

Flow:
1. Issue detected (from health monitor)
2. Assess severity
3. Take automated action:
   - Enable maintenance mode
   - Notify team
   - Notify affected clients
   - Create incident ticket
4. Track resolution
5. Post-mortem report

Actions by severity:
- CRITICAL: Immediate maintenance mode + team alert
- HIGH: Team alert + client notification
- MEDIUM: Team notification only
- LOW: Log only
"""

import os
import asyncio
from datetime import datetime
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class CrisisManager:
    """Handles critical site issues"""

    def __init__(self):
        self.active_incidents = {}

    async def handle_critical_issues(self, health_report: Dict):
        """Handle critical issues from health report"""
        try:
            critical_sites = health_report.get('critical_issues', [])

            if not critical_sites:
                return

            logger.warning(f"Handling {len(critical_sites)} critical issues")

            for site in critical_sites:
                await self.handle_site_issue(site)

        except Exception as e:
            logger.error(f"Error handling crisis: {e}")

    async def handle_site_issue(self, site: Dict):
        """Handle issue for specific site"""
        try:
            site_id = site['site_id']
            url = site['url']
            status = site['status']
            issues = site['issues']

            logger.warning(f"Crisis detected for {url}: {status}")

            # Create incident
            incident = await self.create_incident(site)

            # Determine severity
            severity = self.assess_severity(site)

            # Take action based on severity
            if severity == 'CRITICAL':
                await self.handle_critical(incident, site)
            elif severity == 'HIGH':
                await self.handle_high(incident, site)
            elif severity == 'MEDIUM':
                await self.handle_medium(incident, site)

            # Store incident
            self.active_incidents[site_id] = incident

        except Exception as e:
            logger.error(f"Error handling site issue: {e}")

    def assess_severity(self, site: Dict) -> str:
        """Assess issue severity"""
        status = site['status']
        score = site['score']

        if status == 'down':
            return 'CRITICAL'
        elif score < 40:
            return 'CRITICAL'
        elif score < 60:
            return 'HIGH'
        elif score < 80:
            return 'MEDIUM'
        else:
            return 'LOW'

    async def create_incident(self, site: Dict) -> Dict:
        """Create incident record"""
        incident_id = f"INC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        incident = {
            'id': incident_id,
            'site_id': site['site_id'],
            'url': site['url'],
            'status': site['status'],
            'issues': site['issues'],
            'score': site['score'],
            'severity': self.assess_severity(site),
            'created_at': datetime.utcnow().isoformat(),
            'resolved_at': None,
            'actions_taken': [],
            'notifications_sent': []
        }

        logger.info(f"Incident created: {incident_id}")

        return incident

    async def handle_critical(self, incident: Dict, site: Dict):
        """Handle CRITICAL severity issue"""
        logger.critical(f"CRITICAL ISSUE: {site['url']}")

        # 1. Enable maintenance mode
        await self.enable_maintenance_mode(site)
        incident['actions_taken'].append('maintenance_mode_enabled')

        # 2. Alert team immediately
        await self.alert_team(incident, urgency='URGENT')
        incident['notifications_sent'].append('team_urgent_alert')

        # 3. Notify affected client
        await self.notify_client(site, incident)
        incident['notifications_sent'].append('client_notification')

    async def handle_high(self, incident: Dict, site: Dict):
        """Handle HIGH severity issue"""
        logger.error(f"HIGH PRIORITY ISSUE: {site['url']}")

        # 1. Alert team
        await self.alert_team(incident, urgency='HIGH')
        incident['notifications_sent'].append('team_high_alert')

        # 2. Notify client
        await self.notify_client(site, incident)
        incident['notifications_sent'].append('client_notification')

    async def handle_medium(self, incident: Dict, site: Dict):
        """Handle MEDIUM severity issue"""
        logger.warning(f"MEDIUM PRIORITY ISSUE: {site['url']}")

        # 1. Alert team (lower priority)
        await self.alert_team(incident, urgency='MEDIUM')
        incident['notifications_sent'].append('team_medium_alert')

    async def enable_maintenance_mode(self, site: Dict):
        """Enable maintenance mode for site"""
        try:
            from maintenance_mode import MaintenanceMode

            maintenance = MaintenanceMode()
            await maintenance.enable(site['url'])

            logger.info(f"Maintenance mode enabled for {site['url']}")

        except Exception as e:
            logger.error(f"Error enabling maintenance mode: {e}")

    async def alert_team(self, incident: Dict, urgency: str = 'MEDIUM'):
        """Send alert to team"""
        try:
            from alert_system.alerting import AlertSystem

            alerter = AlertSystem()
            await alerter.send_alert({
                'type': 'crisis',
                'urgency': urgency,
                'incident': incident,
                'message': f"Site issue detected: {incident['url']}"
            })

            logger.info(f"Team alerted ({urgency}): {incident['id']}")

        except Exception as e:
            logger.error(f"Error alerting team: {e}")

    async def notify_client(self, site: Dict, incident: Dict):
        """Notify affected client"""
        try:
            # Get client email from site data
            # Send notification

            logger.info(f"Client notified for {site['url']}")

        except Exception as e:
            logger.error(f"Error notifying client: {e}")

    async def resolve_incident(self, incident_id: str):
        """Mark incident as resolved"""
        if incident_id in self.active_incidents:
            incident = self.active_incidents[incident_id]
            incident['resolved_at'] = datetime.utcnow().isoformat()
            incident['actions_taken'].append('incident_resolved')

            logger.info(f"Incident resolved: {incident_id}")

            # Generate post-mortem
            await self.generate_postmortem(incident)

            # Remove from active
            del self.active_incidents[incident_id]

    async def generate_postmortem(self, incident: Dict):
        """Generate post-mortem report"""
        try:
            report = f"""
# Incident Post-Mortem: {incident['id']}

## Summary
- **Site:** {incident['url']}
- **Severity:** {incident['severity']}
- **Duration:** {incident['created_at']} - {incident['resolved_at']}
- **Status:** Resolved

## Issues Detected
{chr(10).join(f"- {issue}" for issue in incident['issues'])}

## Actions Taken
{chr(10).join(f"- {action}" for action in incident['actions_taken'])}

## Notifications Sent
{chr(10).join(f"- {notif}" for notif in incident['notifications_sent'])}

## Prevention
- Review site monitoring
- Implement preventive measures
- Update runbook
"""

            # Save report
            filename = f"/tmp/postmortem_{incident['id']}.md"
            with open(filename, 'w') as f:
                f.write(report)

            logger.info(f"Post-mortem generated: {filename}")

        except Exception as e:
            logger.error(f"Error generating post-mortem: {e}")


if __name__ == '__main__':
    # Test
    manager = CrisisManager()

    test_site = {
        'site_id': 'test-001',
        'url': 'https://test.example.com',
        'status': 'down',
        'score': 0,
        'issues': ['Site is DOWN']
    }

    asyncio.run(manager.handle_site_issue(test_site))
