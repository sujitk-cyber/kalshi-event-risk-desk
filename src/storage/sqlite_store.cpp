#include "storage/sqlite_store.h"

#include <spdlog/spdlog.h>

#include <stdexcept>

namespace storage {

SQLiteStore::SQLiteStore(const std::string &path) : path_(path) {
  if (sqlite3_open(path_.c_str(), &db_) != SQLITE_OK) {
    throw std::runtime_error("Failed to open sqlite db");
  }
}

SQLiteStore::~SQLiteStore() {
  if (db_) {
    sqlite3_close(db_);
  }
}

void SQLiteStore::Init() {
  Exec("CREATE TABLE IF NOT EXISTS markets ("
       "ticker TEXT PRIMARY KEY,"
       "event_ticker TEXT,"
       "status TEXT,"
       "category TEXT,"
       "yes_bid REAL,"
       "yes_ask REAL,"
       "last_price REAL,"
       "volume REAL,"
       "updated_at TEXT,"
       "raw_json TEXT"
       ");");

  Exec("CREATE TABLE IF NOT EXISTS features ("
       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
       "ticker TEXT,"
       "ts TEXT,"
       "mid REAL,"
       "spread REAL,"
       "prob REAL,"
       "volume REAL,"
       "raw_json TEXT"
       ");");

  Exec("CREATE TABLE IF NOT EXISTS alerts ("
       "id INTEGER PRIMARY KEY AUTOINCREMENT,"
       "ticker TEXT,"
       "ts TEXT,"
       "type TEXT,"
       "score REAL,"
       "details TEXT"
       ");");
}

void SQLiteStore::UpsertMarket(const analytics::MarketSnapshot &snapshot, const std::string &raw_json) {
  const char *sql =
      "INSERT INTO markets (ticker, event_ticker, status, category, yes_bid, yes_ask, last_price, volume, updated_at, raw_json)"
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      " ON CONFLICT(ticker) DO UPDATE SET"
      " event_ticker=excluded.event_ticker,"
      " status=excluded.status,"
      " category=excluded.category,"
      " yes_bid=excluded.yes_bid,"
      " yes_ask=excluded.yes_ask,"
      " last_price=excluded.last_price,"
      " volume=excluded.volume,"
      " updated_at=excluded.updated_at,"
      " raw_json=excluded.raw_json";

  sqlite3_stmt *stmt = nullptr;
  if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
    spdlog::error("Failed to prepare upsert market");
    return;
  }

  sqlite3_bind_text(stmt, 1, snapshot.ticker.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 2, snapshot.event_ticker.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 3, snapshot.status.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 4, snapshot.category.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_double(stmt, 5, snapshot.yes_bid);
  sqlite3_bind_double(stmt, 6, snapshot.yes_ask);
  sqlite3_bind_double(stmt, 7, snapshot.last_price);
  sqlite3_bind_double(stmt, 8, snapshot.volume);
  sqlite3_bind_text(stmt, 9, snapshot.updated_at.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 10, raw_json.c_str(), -1, SQLITE_TRANSIENT);

  if (sqlite3_step(stmt) != SQLITE_DONE) {
    spdlog::error("Failed to upsert market");
  }

  sqlite3_finalize(stmt);
}

void SQLiteStore::InsertFeature(const analytics::FeatureRow &feature, const std::string &raw_json) {
  const char *sql =
      "INSERT INTO features (ticker, ts, mid, spread, prob, volume, raw_json)"
      " VALUES (?, ?, ?, ?, ?, ?, ?)";

  sqlite3_stmt *stmt = nullptr;
  if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
    spdlog::error("Failed to prepare insert feature");
    return;
  }

  sqlite3_bind_text(stmt, 1, feature.ticker.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 2, feature.ts.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_double(stmt, 3, feature.mid);
  sqlite3_bind_double(stmt, 4, feature.spread);
  sqlite3_bind_double(stmt, 5, feature.prob);
  sqlite3_bind_double(stmt, 6, feature.volume);
  sqlite3_bind_text(stmt, 7, raw_json.c_str(), -1, SQLITE_TRANSIENT);

  if (sqlite3_step(stmt) != SQLITE_DONE) {
    spdlog::error("Failed to insert feature");
  }

  sqlite3_finalize(stmt);
}

void SQLiteStore::InsertAlert(const analytics::Alert &alert) {
  const char *sql =
      "INSERT INTO alerts (ticker, ts, type, score, details)"
      " VALUES (?, ?, ?, ?, ?)";

  sqlite3_stmt *stmt = nullptr;
  if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
    spdlog::error("Failed to prepare insert alert");
    return;
  }

  sqlite3_bind_text(stmt, 1, alert.ticker.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 2, alert.ts.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_text(stmt, 3, alert.type.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_double(stmt, 4, alert.score);
  sqlite3_bind_text(stmt, 5, alert.details.c_str(), -1, SQLITE_TRANSIENT);

  if (sqlite3_step(stmt) != SQLITE_DONE) {
    spdlog::error("Failed to insert alert");
  }

  sqlite3_finalize(stmt);
}

std::vector<analytics::Alert> SQLiteStore::RecentAlerts(int limit) const {
  std::vector<analytics::Alert> results;
  const char *sql = "SELECT ticker, ts, type, score, details FROM alerts ORDER BY id DESC LIMIT ?";

  sqlite3_stmt *stmt = nullptr;
  if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
    spdlog::error("Failed to prepare recent alerts");
    return results;
  }

  sqlite3_bind_int(stmt, 1, limit);

  while (sqlite3_step(stmt) == SQLITE_ROW) {
    analytics::Alert alert;
    alert.ticker = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 0));
    alert.ts = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 1));
    alert.type = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 2));
    alert.score = sqlite3_column_double(stmt, 3);
    alert.details = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 4));
    results.push_back(alert);
  }

  sqlite3_finalize(stmt);
  return results;
}

std::vector<analytics::FeatureRow> SQLiteStore::LatestFeatures(const std::string &ticker, int limit) const {
  std::vector<analytics::FeatureRow> results;
  const char *sql =
      "SELECT ticker, ts, mid, spread, prob, volume FROM features WHERE ticker = ? ORDER BY id DESC LIMIT ?";

  sqlite3_stmt *stmt = nullptr;
  if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) {
    spdlog::error("Failed to prepare latest features");
    return results;
  }

  sqlite3_bind_text(stmt, 1, ticker.c_str(), -1, SQLITE_TRANSIENT);
  sqlite3_bind_int(stmt, 2, limit);

  while (sqlite3_step(stmt) == SQLITE_ROW) {
    analytics::FeatureRow feature;
    feature.ticker = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 0));
    feature.ts = reinterpret_cast<const char *>(sqlite3_column_text(stmt, 1));
    feature.mid = sqlite3_column_double(stmt, 2);
    feature.spread = sqlite3_column_double(stmt, 3);
    feature.prob = sqlite3_column_double(stmt, 4);
    feature.volume = sqlite3_column_double(stmt, 5);
    results.push_back(feature);
  }

  sqlite3_finalize(stmt);
  return results;
}

void SQLiteStore::Exec(const std::string &sql) const {
  char *err = nullptr;
  if (sqlite3_exec(db_, sql.c_str(), nullptr, nullptr, &err) != SQLITE_OK) {
    spdlog::error("SQLite error: {}", err ? err : "unknown");
    sqlite3_free(err);
  }
}

}  // namespace storage
