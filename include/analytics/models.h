#pragma once

#include <string>

namespace analytics {

struct MarketSnapshot {
  std::string ticker;
  std::string event_ticker;
  std::string status;
  std::string category;
  double yes_bid = 0.0;
  double yes_ask = 0.0;
  double last_price = 0.0;
  double volume = 0.0;
  std::string updated_at;
};

struct FeatureRow {
  std::string ticker;
  std::string ts;
  double mid = 0.0;
  double spread = 0.0;
  double prob = 0.0;
  double volume = 0.0;
};

struct Alert {
  std::string ticker;
  std::string ts;
  std::string type;
  double score = 0.0;
  std::string details;
};

}  // namespace analytics
