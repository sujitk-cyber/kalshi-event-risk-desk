#pragma once

#include "analytics/models.h"

#include <unordered_map>
#include <vector>

namespace analytics {

class AlertEngine {
 public:
  std::vector<Alert> Evaluate(const FeatureRow &feature);

 private:
  std::unordered_map<std::string, FeatureRow> last_feature_;
};

}  // namespace analytics
