#pragma once

#include "analytics/models.h"

#include <unordered_map>
#include <vector>

namespace analytics {

class AlertEngine {
 public:
  AlertEngine(double jump_threshold = 5.0, double spread_threshold = 10.0);
  std::vector<Alert> Evaluate(const FeatureRow &feature);

 private:
  double jump_threshold_;
  double spread_threshold_;
  std::unordered_map<std::string, FeatureRow> last_feature_;
};

}  // namespace analytics
