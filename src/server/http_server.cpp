#include "server/http_server.h"

#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>

#include <fstream>
#include <sstream>

namespace server {

HttpServer::HttpServer(std::shared_ptr<kalshi::KalshiClient> client,
                       std::shared_ptr<storage::SQLiteStore> store,
                       std::shared_ptr<analytics::FeatureEngine> features,
                       std::shared_ptr<analytics::AlertEngine> alerts)
    : client_(std::move(client)),
      store_(std::move(store)),
      features_(std::move(features)),
      alerts_(std::move(alerts)) {
  RegisterRoutes();
}

void HttpServer::Run(int port) {
  spdlog::info("Starting HTTP server on port {}", port);
  server_.listen("0.0.0.0", port);
}

void HttpServer::RegisterRoutes() {
  server_.set_base_dir("ui");

  server_.Get("/", [](const httplib::Request &, httplib::Response &res) {
    std::ifstream file("ui/index.html", std::ios::binary);
    if (!file) {
      res.status = 404;
      res.set_content("index.html not found", "text/plain");
      return;
    }
    std::ostringstream buffer;
    buffer << file.rdbuf();
    res.set_content(buffer.str(), "text/html");
  });

  server_.Get("/health", [](const httplib::Request &, httplib::Response &res) {
    res.set_content("ok", "text/plain");
  });

  server_.Get("/markets", [this](const httplib::Request &req, httplib::Response &res) {
    int limit = 200;
    if (req.has_param("limit")) {
      limit = std::stoi(req.get_param_value("limit"));
    }
    std::string search;
    if (req.has_param("search")) {
      search = req.get_param_value("search");
    }

    const auto markets = store_->ListMarkets(limit, search);
    nlohmann::json out = nlohmann::json::array();
    for (const auto &market : markets) {
      out.push_back({
          {"ticker", market.ticker},
          {"event_ticker", market.event_ticker},
          {"status", market.status},
          {"category", market.category},
          {"yes_bid", market.yes_bid},
          {"yes_ask", market.yes_ask},
          {"last_price", market.last_price},
          {"volume", market.volume},
          {"updated_at", market.updated_at},
      });
    }
    res.set_content(out.dump(2), "application/json");
  });

  server_.Post("/markets/refresh", [this](const httplib::Request &req, httplib::Response &res) {
    int limit = 100;
    if (req.has_param("limit")) {
      limit = std::stoi(req.get_param_value("limit"));
    }

    RefreshMarkets(limit);
    nlohmann::json out = { {"status", "ok"}, {"limit", limit} };
    res.set_content(out.dump(2), "application/json");
  });

  server_.Get("/alerts", [this](const httplib::Request &req, httplib::Response &res) {
    int limit = 50;
    if (req.has_param("limit")) {
      limit = std::stoi(req.get_param_value("limit"));
    }

    const auto alerts = store_->RecentAlerts(limit);
    nlohmann::json out = nlohmann::json::array();
    for (const auto &alert : alerts) {
      out.push_back({
          {"ticker", alert.ticker},
          {"ts", alert.ts},
          {"type", alert.type},
          {"score", alert.score},
          {"details", alert.details},
      });
    }

    res.set_content(out.dump(2), "application/json");
  });

  server_.Get(R"(/features/([A-Za-z0-9_-]+))", [this](const httplib::Request &req, httplib::Response &res) {
    const std::string ticker = req.matches[1];
    int limit = 50;
    if (req.has_param("limit")) {
      limit = std::stoi(req.get_param_value("limit"));
    }

    const auto features = store_->LatestFeatures(ticker, limit);
    nlohmann::json out = nlohmann::json::array();
    for (const auto &feature : features) {
      out.push_back({
          {"ticker", feature.ticker},
          {"ts", feature.ts},
          {"mid", feature.mid},
          {"spread", feature.spread},
          {"prob", feature.prob},
          {"volume", feature.volume},
      });
    }

    res.set_content(out.dump(2), "application/json");
  });
}

void HttpServer::RefreshMarkets(int limit) {
  auto response = client_->GetMarkets(limit);
  if (response.is_null()) {
    spdlog::warn("Empty response from markets");
    return;
  }

  nlohmann::json markets;
  if (response.contains("markets")) {
    markets = response["markets"];
  } else {
    markets = response;
  }

  if (!markets.is_array()) {
    spdlog::warn("Markets response not array");
    return;
  }

  for (const auto &market : markets) {
    analytics::MarketSnapshot snapshot = features_->ParseMarketSnapshot(market);
    if (snapshot.ticker.empty()) {
      continue;
    }

    store_->UpsertMarket(snapshot, market.dump());

    analytics::FeatureRow feature = features_->ComputeFeatures(snapshot);
    store_->InsertFeature(feature, market.dump());

    const auto alerts = alerts_->Evaluate(feature);
    for (const auto &alert : alerts) {
      store_->InsertAlert(alert);
    }
  }
}

}  // namespace server
