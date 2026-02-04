#pragma once

#include "analytics/models.h"

#include <sqlite3.h>

#include <string>
#include <vector>

namespace storage {

class SQLiteStore {
 public:
  explicit SQLiteStore(const std::string &path);
  ~SQLiteStore();

  void Init();

  void UpsertMarket(const analytics::MarketSnapshot &snapshot, const std::string &raw_json);
  void InsertFeature(const analytics::FeatureRow &feature, const std::string &raw_json);
  void InsertAlert(const analytics::Alert &alert);

  std::vector<analytics::Alert> RecentAlerts(int limit = 50) const;
  std::vector<analytics::FeatureRow> LatestFeatures(const std::string &ticker, int limit = 50) const;

 private:
  sqlite3 *db_ = nullptr;
  std::string path_;

  void Exec(const std::string &sql) const;
};

}  // namespace storage
