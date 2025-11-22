# WAAS 2.0 - Site Health Monitor

Monitors health of all 100+ affiliate sites.

## Features

✅ **Uptime Monitoring** - HTTP 200 checks every 5 minutes
✅ **SSL Certificate Monitoring** - Expiration warnings (< 30 days)
✅ **Performance Tracking** - Response time monitoring
✅ **WordPress Health** - REST API, PHP errors, database checks
✅ **Concurrent Checks** - Async checks for all sites
✅ **Health Scoring** - 0-100 score per site
✅ **Automatic Alerting** - Triggers crisis management

## Health Check Flow

```
1. Fetch list of sites from database
   ↓
2. Run checks concurrently (async)
   - Uptime (HTTP 200)
   - SSL validity & expiration
   - Response time
   - WordPress health
   ↓
3. Calculate health score (0-100)
   ↓
4. Determine status:
   - healthy (80-100)
   - warning (60-79)
   - critical (< 60)
   - down (0)
   ↓
5. Store results in database
   ↓
6. If critical/down → Trigger crisis management
```

## Health Scoring

| Check | Impact |
|-------|--------|
| Site DOWN | -50 points (critical) |
| SSL Invalid | -20 points |
| SSL Expires <30 days | -10 points |
| Response >3s | -15 points |
| Response 2-3s | -5 points |
| WordPress errors | -20 points |

## Installation

```bash
cd monitoring/site-health-monitor
pip install -r requirements.txt
```

## Usage

### API Mode

```bash
python health_monitor.py
```

Service runs on port 5010.

### Standalone Mode

```python
from health_monitor import HealthMonitor
import asyncio

monitor = HealthMonitor()

sites = [
    {'id': 'site1', 'url': 'https://example.com'},
    {'id': 'site2', 'url': 'https://example2.com'},
]

# Check all sites
results = asyncio.run(monitor.check_all_sites(sites))

# Generate report
report = monitor.generate_report(results)
print(report)
```

### Continuous Monitoring

```python
# Run monitoring loop (checks every 5 minutes)
asyncio.run(monitor.monitor_loop(sites, interval_seconds=300))
```

## API Endpoints

### POST /api/health/check-all

Trigger health check for all sites.

```bash
curl -X POST http://localhost:5010/api/health/check-all \
  -H "Content-Type: application/json" \
  -d '{
    "sites": [
      {"id": "site1", "url": "https://example.com"},
      {"id": "site2", "url": "https://example2.com"}
    ]
  }'
```

Response:
```json
{
  "success": true,
  "report": {
    "total_sites": 2,
    "healthy": 2,
    "warning": 0,
    "critical": 0,
    "down": 0,
    "health_percentage": 100,
    "average_score": 95.5
  }
}
```

### GET /api/health/report

Get latest health report.

### GET /api/health/site/{site_id}

Get health status for specific site.

## Integration

### With Crisis Management

When critical issues detected:

```python
# Automatically triggered
if report['critical'] > 0 or report['down'] > 0:
    await monitor.trigger_crisis_management(report)
```

### With Dashboard

```python
# Real-time dashboard updates
results = await monitor.check_all_sites(sites)
dashboard.update(results)
```

## Monitoring Schedule

| Check Type | Frequency |
|------------|-----------|
| Uptime | 5 minutes |
| SSL | 1 hour |
| Performance | 5 minutes |
| WordPress | 15 minutes |

## Example Output

```json
{
  "site_id": "camping-gear-123",
  "url": "https://camping-gear.lk24.shop",
  "status": "healthy",
  "uptime": true,
  "ssl_valid": true,
  "response_time_ms": 850,
  "wordpress_ok": true,
  "score": 100,
  "issues": [],
  "last_checked": "2025-11-22T14:30:00Z"
}
```

## Support

GitHub Issues: https://github.com/LUKOAI/LUKO-WAAS/issues
