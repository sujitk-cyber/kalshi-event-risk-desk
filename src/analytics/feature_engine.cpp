#include "analytics/feature_engine.h"

#include <chrono>
#include <ctime>

namespace analytics {

namespace {
std::string GetString(const nlohmann::json &obj, const char *key) {
  if (obj.contains(key) && obj[key].is_string()) {
    return obj[key].get<std::string>();
  }
  return "";
}

double GetDouble(const nlohmann::json &obj, const char *key) {
  if (obj.contains(key) && obj[key].is_number()) {
    return obj[key].get<double>();
  }
  return 0.0;
}

std::string NowIso() {
  using namespace std::chrono;
  auto now = system_clock::now();
  auto now_time = system_clock::to_time_t(now);
  std::tm tm{};
#if defined(_WIN32)
  gmtime_s(&tm, &now_time);
#else
  gmtime_r(&now_time, &tm);
#endif
  char buffer[32];
  std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &tm);
  return std::string(buffer);
}

}  // namespace

MarketSnapshot FeatureEngine::ParseMarketSnapshot(const nlohmann::json &market) const {
  MarketSnapshot snapshot;
  snapshot.ticker = GetString(market, "ticker");
  snapshot.event_ticker = GetString(market, "event_ticker");
  snapshot.status = GetString(market, "status");
  snapshot.category = GetString(market, "category");
  snapshot.yes_bid = GetDouble(market, "yes_bid");
  snapshot.yes_ask = GetDouble(market, "yes_ask");
  snapshot.last_price = GetDouble(market, "last_price");
  snapshot.volume = GetDouble(market, "volume");
  snapshot.updated_at = GetString(market, "updated_at");

  if (snapshot.updated_at.empty()) {
    snapshot.updated_at = NowIso();
  }

  return snapshot;
}

FeatureRow FeatureEngine::ComputeFeatures(const MarketSnapshot &snapshot) const {
  FeatureRow row;
  row.ticker = snapshot.ticker;
  row.ts = snapshot.updated_at;

  if (snapshot.yes_bid > 0.0 && snapshot.yes_ask > 0.0) {
    row.mid = (snapshot.yes_bid + snapshot.yes_ask) / 2.0;
    row.spread = snapshot.yes_ask - snapshot.yes_bid;
  } else {
    row.mid = snapshot.last_price;
    row.spread = 0.0;
  }

  if (snapshot.last_price > 0.0) {
    row.prob = snapshot.last_price / 100.0;
  } else if (row.mid > 0.0) {
    row.prob = row.mid / 100.0;
  }

  row.volume = snapshot.volume;
  return row;
}

}  // namespace analytics
