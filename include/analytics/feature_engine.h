#pragma once

#include "analytics/models.h"

#include <nlohmann/json.hpp>

namespace analytics {

class FeatureEngine {
 public:
  MarketSnapshot ParseMarketSnapshot(const nlohmann::json &market) const;
  FeatureRow ComputeFeatures(const MarketSnapshot &snapshot) const;
};

}  // namespace analytics
