"""
Risk Assessment and Civic Advisory Generation Engine.
"""
from typing import Dict, Any, List


class RiskInsightsService:
    @staticmethod
    def generate_risk_insights(prob: float, pred: int, summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates contextual risk levels, visual indicators, waterlogging depth estimations,
        drainage clearance durations, and safety advisories based on prediction probability.
        """
        if prob >= 0.75:
            risk_level = "Critical"
            risk_color = "#ef4444"
            depth_cm = round(15.0 + (prob - 0.75) * 60.0 + (summary["rainfall_mm"] * 0.15), 1)
            duration_hrs = round(3.5 + (prob * 4.0), 1)
            advisories = [
                "Severe waterlogging expected in major arterial roads and low-lying sectors.",
                "High-capacity municipal stormwater pumps operating at peak load.",
                "Avoid travel through underpasses and canal-adjacent routes.",
                "Move electrical appliances and vehicles to elevated areas.",
            ]
            status_text = "High Risk - Rising"
        elif prob >= 0.50:
            risk_level = "High"
            risk_color = "#f97316"
            depth_cm = round(8.0 + (prob - 0.50) * 30.0 + (summary["rainfall_mm"] * 0.08), 1)
            duration_hrs = round(2.0 + (prob * 3.0), 1)
            advisories = [
                "Moderate to high water accumulation detected on key roads.",
                "Traffic diversions likely in effect near low-elevation ward zones.",
                "Keep emergency contact numbers handy and monitor rainfall nowcasts.",
            ]
            status_text = "Elevated Risk"
        elif prob >= 0.30:
            risk_level = "Moderate"
            risk_color = "#eab308"
            depth_cm = round(3.0 + (prob - 0.30) * 15.0, 1)
            duration_hrs = round(1.0 + (prob * 2.0), 1)
            advisories = [
                "Localized minor puddle formation in internal streets.",
                "Drainage systems are clearing stormwater steadily.",
                "Exercise caution while driving or commuting in peak rain hours.",
            ]
            status_text = "Moderate Warning"
        else:
            risk_level = "Low"
            risk_color = "#22c55e"
            depth_cm = round(max(0.0, prob * 5.0), 1)
            duration_hrs = 0.5
            advisories = [
                "Normal urban conditions. Storm drains operating with optimal clearance.",
                "Safe for transit and outdoor activities.",
            ]
            status_text = "Safe / Low Risk"

        # Identify primary risk drivers
        key_drivers: List[str] = []
        if summary.get("elevation_m", 10.0) <= 5.0:
            key_drivers.append(f"Low Elevation ({summary.get('elevation_m')}m MSL)")
        if summary.get("rainfall_mm", 0.0) >= 65.0:
            key_drivers.append(f"Heavy Rainfall ({summary.get('rainfall_mm')}mm/24h)")
        if summary.get("drainage_load_percent", 0.0) >= 80.0:
            key_drivers.append(f"High Drainage Load ({summary.get('drainage_load_percent')}%)")
        if summary.get("drain_efficiency_index", 10.0) <= 4.0:
            key_drivers.append("Reduced Drainage Capacity / Silt Accumulation")
        if not key_drivers:
            key_drivers.append("Standard Monsoon Baseline")

        return {
            "risk_level": risk_level,
            "risk_color": risk_color,
            "status_text": status_text,
            "estimated_waterlogging_depth_cm": depth_cm,
            "estimated_duration_hours": duration_hrs,
            "advisories": advisories,
            "key_risk_drivers": key_drivers
        }


risk_insights_service = RiskInsightsService()
