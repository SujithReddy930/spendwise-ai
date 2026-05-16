from typing import List, Dict

def generate_insights(
    current: Dict[str, float],
    previous: Dict[str, float],
    current_total: float,
    previous_total: float,
    current_month: str,
    previous_month: str
) -> List[str]:
    insights = []

    if previous_total > 0:
        change_pct = ((current_total - previous_total) / previous_total) * 100
        if change_pct > 15:
            insights.append(f"⚠️ Your total spending increased by {abs(change_pct):.0f}% compared to {previous_month}.")
        elif change_pct < -10:
            insights.append(f"✅ Great job! You spent {abs(change_pct):.0f}% less than {previous_month}. Keep it up!")
        else:
            insights.append(f"📊 Your spending is similar to {previous_month} ({'up' if change_pct > 0 else 'down'} {abs(change_pct):.0f}%).")

    if current:
        top_cat = max(current, key=current.get)
        top_amt = current[top_cat]
        top_pct = (top_amt / current_total * 100) if current_total > 0 else 0
        insights.append(f"💸 Your biggest spend is {top_cat} at ₹{top_amt:,.0f} ({top_pct:.0f}% of total).")

    for cat, amt in current.items():
        prev_amt = previous.get(cat, 0)
        if prev_amt > 0:
            cat_change = ((amt - prev_amt) / prev_amt) * 100
            if cat_change > 30:
                insights.append(f"🔺 {cat} expenses jumped {cat_change:.0f}% this month (₹{amt:,.0f} vs ₹{prev_amt:,.0f}).")
            elif cat_change < -25:
                insights.append(f"🟢 You saved on {cat} — down {abs(cat_change):.0f}% this month.")
        elif prev_amt == 0 and amt > 0:
            insights.append(f"🆕 New category this month: {cat} (₹{amt:,.0f}).")

    if current_total > 0:
        daily_avg = current_total / 16
        projected = daily_avg * 30
        insights.append(f"📅 At your current pace, you'll spend around ₹{projected:,.0f} this month.")

    return insights[:5]