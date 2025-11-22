#!/usr/bin/env python3
"""
WAAS 2.0 - Revenue Dashboard API
=================================

Real-time revenue tracking and forecasting.

Metrics:
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Churn Rate
- Customer Lifetime Value (LTV)
- Customer Acquisition Cost (CAC)
- Revenue forecasting
"""

from flask import Flask, jsonify
from datetime import datetime, timedelta
from typing import Dict
import logging

logger = logging.getLogger(__name__)

app = Flask(__name__)


class RevenueMetrics:
    """Calculate revenue metrics"""

    def calculate_mrr(self) -> float:
        """Calculate Monthly Recurring Revenue"""
        # Sum all active monthly subscriptions
        monthly_subs = 50  # Example: 50 customers
        price = 50  # €50/month
        mrr = monthly_subs * price

        yearly_subs = 10  # Example: 10 yearly customers
        yearly_price = 400  # €400/year
        mrr += (yearly_subs * yearly_price) / 12

        return round(mrr, 2)

    def calculate_arr(self) -> float:
        """Calculate Annual Recurring Revenue"""
        return self.calculate_mrr() * 12

    def calculate_churn_rate(self, period_days: int = 30) -> float:
        """Calculate churn rate"""
        # (Customers lost / Total customers at start) * 100
        return 5.2  # Example: 5.2%

    def calculate_ltv(self) -> float:
        """Calculate Customer Lifetime Value"""
        avg_monthly_revenue = 50
        avg_lifetime_months = 24  # 2 years
        return avg_monthly_revenue * avg_lifetime_months

    def calculate_cac(self) -> float:
        """Calculate Customer Acquisition Cost"""
        # From FAZA 3 - we calculated ~€50-80
        return 65.0

    def get_dashboard_data(self) -> Dict:
        """Get complete dashboard data"""
        mrr = self.calculate_mrr()
        arr = self.calculate_arr()
        churn = self.calculate_churn_rate()
        ltv = self.calculate_ltv()
        cac = self.calculate_cac()

        return {
            'timestamp': datetime.utcnow().isoformat(),
            'mrr': mrr,
            'arr': arr,
            'churn_rate': churn,
            'ltv': ltv,
            'cac': cac,
            'ltv_cac_ratio': round(ltv / cac, 2),
            'forecast_90d': round(mrr * 3, 2),
            'health_score': 'excellent' if ltv / cac > 3 else 'good'
        }


metrics = RevenueMetrics()


@app.route('/api/revenue/dashboard', methods=['GET'])
def get_dashboard():
    """Get revenue dashboard data"""
    data = metrics.get_dashboard_data()
    return jsonify({'success': True, 'data': data}), 200


@app.route('/api/revenue/mrr', methods=['GET'])
def get_mrr():
    """Get MRR"""
    mrr = metrics.calculate_mrr()
    return jsonify({'success': True, 'mrr': mrr}), 200


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'revenue-dashboard',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


if __name__ == '__main__':
    import os
    port = int(os.getenv('PORT', 5011))
    app.run(host='0.0.0.0', port=port, debug=False)
