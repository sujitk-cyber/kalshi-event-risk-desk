#include "kalshi/kalshi_client.h"

#include "kalshi/kalshi_signer.h"
#include "utils/base64.h"

#include <chrono>
#include <sstream>

#include <spdlog/spdlog.h>

namespace kalshi {

namespace {
std::string NowMs() {
  using namespace std::chrono;
  const auto now = time_point_cast<milliseconds>(system_clock::now());
  return std::to_string(now.time_since_epoch().count());
}

nlohmann::json ParseJsonResponse(const utils::HttpResponse &response) {
  if (response.body.empty()) {
    return nlohmann::json::object();
  }

  try {
    return nlohmann::json::parse(response.body);
  } catch (const std::exception &ex) {
    spdlog::error("Failed to parse JSON: {}", ex.what());
    return nlohmann::json::object();
  }
}

}  // namespace

KalshiClient::KalshiClient(KalshiClientConfig config, std::shared_ptr<utils::HttpClient> http)
    : config_(std::move(config)), http_(std::move(http)) {}

nlohmann::json KalshiClient::GetMarkets(int limit, const std::string &cursor) {
  std::ostringstream path;
  path << "/markets?limit=" << limit;
  if (!cursor.empty()) {
    path << "&cursor=" << cursor;
  }

  auto response = http_->Get(BuildUrl(path.str()));
  return ParseJsonResponse(response);
}

nlohmann::json KalshiClient::GetMarket(const std::string &ticker) {
  std::string path = "/markets/" + ticker;
  auto response = http_->Get(BuildUrl(path));
  return ParseJsonResponse(response);
}

nlohmann::json KalshiClient::GetEvents(int limit, const std::string &cursor) {
  std::ostringstream path;
  path << "/events?limit=" << limit;
  if (!cursor.empty()) {
    path << "&cursor=" << cursor;
  }

  auto response = http_->Get(BuildUrl(path.str()));
  return ParseJsonResponse(response);
}

nlohmann::json KalshiClient::GetPortfolio() {
  const std::string path = "/portfolio";
  const std::string body = "";
  auto headers = BuildAuthHeaders("GET", path, body);
  auto response = http_->Get(BuildUrl(path), headers);
  return ParseJsonResponse(response);
}

std::string KalshiClient::BuildUrl(const std::string &path) const {
  return config_.base_url + path;
}

std::map<std::string, std::string> KalshiClient::BuildAuthHeaders(const std::string &method,
                                                                   const std::string &path,
                                                                   const std::string &body) const {
  std::map<std::string, std::string> headers;
  if (config_.api_key.empty() || config_.private_key_path.empty()) {
    spdlog::warn("Kalshi auth missing; returning empty headers");
    return headers;
  }

  const std::string timestamp = NowMs();
  const std::string payload = timestamp + method + path + body;

  std::string signature_b64;
  try {
    KalshiSigner signer(config_.private_key_path);
    const std::string raw_signature = signer.SignPssSha256(payload);
    signature_b64 = utils::Base64Encode(raw_signature);
  } catch (const std::exception &ex) {
    spdlog::error("Failed to sign request: {}", ex.what());
    return headers;
  }

  headers["KALSHI-ACCESS-KEY"] = config_.api_key;
  headers["KALSHI-ACCESS-SIGNATURE"] = signature_b64;
  headers["KALSHI-ACCESS-TIMESTAMP"] = timestamp;

  return headers;
}

}  // namespace kalshi
