from typing import List, Dict
import numpy as np

def predict_month_end(
    monthly_totals: List[float],
    current_spent: float,
    days_elapsed: int,
    total_days: int = 30
) -> Dict:
    if days_elapsed > 0:
        daily_rate = current_spent / days_elapsed
        linear_prediction = daily_rate * total_days
    else:
        linear_prediction = current_spent

    if len(monthly_totals) >= 2:
        hist_avg = float(np.mean(monthly_totals))
        hist_std = float(np.std(monthly_totals))
        blended = (0.6 * linear_prediction) + (0.4 * hist_avg)
        low = max(0, blended - hist_std)
        high = blended + hist_std
    else:
        blended = linear_prediction
        hist_avg = blended
        low = blended * 0.85
        high = blended * 1.15

    days_remaining = total_days - days_elapsed

    return {
        "predicted_total": round(blended, 2),
        "low_estimate": round(low, 2),
        "high_estimate": round(high, 2),
        "daily_rate": round(current_spent / max(days_elapsed, 1), 2),
        "days_remaining": days_remaining,
        "historical_average": round(hist_avg, 2),
        "confidence": "high" if len(monthly_totals) >= 3 else "medium" if len(monthly_totals) >= 1 else "low"
    }