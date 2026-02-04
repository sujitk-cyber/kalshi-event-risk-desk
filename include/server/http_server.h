#pragma once

#include "analytics/alert_engine.h"
#include "analytics/feature_engine.h"
#include "kalshi/kalshi_client.h"
#include "storage/sqlite_store.h"

#include <httplib.h>

#include <memory>

namespace server {

class HttpServer {
 public:
  HttpServer(std::shared_ptr<kalshi::KalshiClient> client,
             std::shared_ptr<storage::SQLiteStore> store,
             std::shared_ptr<analytics::FeatureEngine> features,
             std::shared_ptr<analytics::AlertEngine> alerts);

  void Run(int port);
  void RefreshMarkets(int limit);

 private:
  void RegisterRoutes();

  std::shared_ptr<kalshi::KalshiClient> client_;
  std::shared_ptr<storage::SQLiteStore> store_;
  std::shared_ptr<analytics::FeatureEngine> features_;
  std::shared_ptr<analytics::AlertEngine> alerts_;
  httplib::Server server_;
};

}  // namespace server
