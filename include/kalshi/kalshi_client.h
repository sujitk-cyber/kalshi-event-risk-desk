#pragma once

#include "utils/http_client.h"

#include <memory>
#include <string>

#include <nlohmann/json.hpp>

namespace kalshi {

struct KalshiClientConfig {
  std::string base_url;
  std::string api_key;
  std::string private_key_path;
  bool use_demo = false;
};

class KalshiClient {
 public:
  KalshiClient(KalshiClientConfig config, std::shared_ptr<utils::HttpClient> http);

  nlohmann::json GetMarkets(int limit = 100, const std::string &cursor = "");
  nlohmann::json GetMarket(const std::string &ticker);
  nlohmann::json GetEvents(int limit = 100, const std::string &cursor = "");

  // Requires auth
  nlohmann::json GetPortfolio();

 private:
  std::string BuildUrl(const std::string &path) const;
  std::map<std::string, std::string> BuildAuthHeaders(const std::string &method,
                                                      const std::string &path,
                                                      const std::string &body) const;

  KalshiClientConfig config_;
  std::shared_ptr<utils::HttpClient> http_;
};

}  // namespace kalshi
