#include "analytics/alert_engine.h"
#include "analytics/feature_engine.h"
#include "kalshi/kalshi_client.h"
#include "storage/sqlite_store.h"
#include "utils/env.h"
#include "utils/http_client.h"
#include "server/http_server.h"

#include <spdlog/spdlog.h>

#include <curl/curl.h>
#include <sqlite3.h>

#include <memory>
#include <string>

namespace {

bool HasArg(int argc, char **argv, const std::string &flag) {
  for (int i = 1; i < argc; ++i) {
    if (flag == argv[i]) {
      return true;
    }
  }
  return false;
}

}  // namespace

int main(int argc, char **argv) {
  curl_global_init(CURL_GLOBAL_DEFAULT);
  sqlite3_config(SQLITE_CONFIG_SERIALIZED);
  sqlite3_initialize();

  const std::string env = utils::GetEnv("KALSHI_ENV", "demo");
  std::string base_url = utils::GetEnv("KALSHI_BASE_URL", "");
  if (base_url.empty()) {
    base_url = (env == "prod")
        ? "https://api.elections.kalshi.com/trade-api/v2"
        : "https://demo-api.kalshi.co/trade-api/v2";
  }

  kalshi::KalshiClientConfig config;
  config.base_url = base_url;
  config.api_key = utils::GetEnv("KALSHI_API_KEY", "");
  config.private_key_path = utils::GetEnv("KALSHI_PRIVATE_KEY", "");
  config.use_demo = env != "prod";

  const std::string db_path = utils::GetEnv("KALSHI_DB_PATH", "data/kalshi.db");
  const int port = utils::GetEnvInt("KALSHI_PORT", 8080);
  const int limit = utils::GetEnvInt("KALSHI_REFRESH_LIMIT", 100);
  const double jump_threshold = utils::GetEnvDouble("KALSHI_ALERT_JUMP", 5.0);
  const double spread_threshold = utils::GetEnvDouble("KALSHI_ALERT_SPREAD", 10.0);

  auto http = std::make_shared<utils::HttpClient>();
  auto client = std::make_shared<kalshi::KalshiClient>(config, http);
  auto store = std::make_shared<storage::SQLiteStore>(db_path);
  auto features = std::make_shared<analytics::FeatureEngine>();
  auto alerts = std::make_shared<analytics::AlertEngine>(jump_threshold, spread_threshold);

  store->Init();

  if (HasArg(argc, argv, "--once")) {
    spdlog::info("Running one-time refresh");
    server::HttpServer server(client, store, features, alerts);
    server.RefreshMarkets(limit);
    curl_global_cleanup();
    return 0;
  }

  spdlog::info("Kalshi Risk Desk starting with base URL {}", base_url);

  server::HttpServer server(client, store, features, alerts);

  if (utils::GetEnvBool("KALSHI_REFRESH_ON_START", true)) {
    server.RefreshMarkets(limit);
  }

  server.Run(port);

  sqlite3_shutdown();
  curl_global_cleanup();
  return 0;
}
