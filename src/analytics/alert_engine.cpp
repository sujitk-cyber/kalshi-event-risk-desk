#include "analytics/alert_engine.h"

#include <cmath>
#include <sstream>

namespace analytics {

AlertEngine::AlertEngine(double jump_threshold, double spread_threshold)
    : jump_threshold_(jump_threshold), spread_threshold_(spread_threshold) {}

std::vector<Alert> AlertEngine::Evaluate(const FeatureRow &feature) {
  std::vector<Alert> alerts;

  auto iter = last_feature_.find(feature.ticker);
  if (iter != last_feature_.end()) {
    const FeatureRow &prev = iter->second;
    const double jump = std::abs(feature.mid - prev.mid);
    if (jump >= jump_threshold_ && feature.mid > 0.0 && prev.mid > 0.0) {
      Alert alert;
      alert.ticker = feature.ticker;
      alert.ts = feature.ts;
      alert.type = "price_jump";
      alert.score = jump;
      std::ostringstream detail;
      detail << "mid moved from " << prev.mid << " to " << feature.mid;
      alert.details = detail.str();
      alerts.push_back(alert);
    }

    if (feature.spread >= spread_threshold_) {
      Alert alert;
      alert.ticker = feature.ticker;
      alert.ts = feature.ts;
      alert.type = "wide_spread";
      alert.score = feature.spread;
      alert.details = "spread exceeded 10";
      alerts.push_back(alert);
    }
  }

  last_feature_[feature.ticker] = feature;
  return alerts;
}

}  // namespace analytics
