# Kalshi Event Risk Desk (C++ Backend)

A C++ backend for Kalshi market analytics: ingest market data, compute features, emit alerts, and serve an HTTP API for a trading desk UI or scripts.

## Architecture
- `kalshi::KalshiClient`: REST client (public + optional signed requests)
- `analytics::FeatureEngine`: normalize markets into feature rows
- `analytics::AlertEngine`: detect jumps and liquidity stress
- `storage::SQLiteStore`: persistence for markets, features, alerts
- `server::HttpServer`: HTTP endpoints + static UI

## Build
Dependencies:
- CMake 3.20+
- C++17 compiler
- libcurl
- OpenSSL
- sqlite3

```bash
cmake -S . -B build
cmake --build build
```

Offline/system deps build (no FetchContent downloads):
```bash
cmake -S . -B build -DKALSHI_FETCH_DEPS=OFF -DKALSHI_PREFER_SYSTEM_DEPS=ON
cmake --build build
```

## Run
```bash
export KALSHI_ENV=demo
export KALSHI_DB_PATH=data/kalshi.db
./build/kalshi_risk_desk
```

One-time refresh (no server):
```bash
./build/kalshi_risk_desk --once
```

Optional auth (needed for private endpoints like portfolio):
```bash
export KALSHI_API_KEY=your_key
export KALSHI_PRIVATE_KEY=/path/to/private_key.pem
```

## UI
The UI is served from `ui/` by the C++ server.

```bash
open http://localhost:8080
```

## API Endpoints
- `GET /health`
- `GET /markets?limit=200&search=...`
- `POST /markets/refresh?limit=100`
- `GET /alerts?limit=50`
- `GET /features/{TICKER}?limit=50`

## Configuration
Environment variables:
- `KALSHI_ENV` = `demo` or `prod`
- `KALSHI_BASE_URL` overrides default API root
- `KALSHI_API_KEY` for authenticated endpoints
- `KALSHI_PRIVATE_KEY` path to RSA private key PEM
- `KALSHI_DB_PATH` path to SQLite DB
- `KALSHI_PORT` HTTP server port
- `KALSHI_REFRESH_LIMIT` number of markets to fetch
- `KALSHI_REFRESH_ON_START` true/false

## Build Troubleshooting (macOS)
If CMake can’t find dependencies, install them locally:
```bash
brew install cmake curl openssl@3 sqlite3
brew install nlohmann-json spdlog cpp-httplib
```

If you want to avoid network fetches entirely:
```bash
cmake -S . -B build -DKALSHI_FETCH_DEPS=OFF -DKALSHI_PREFER_SYSTEM_DEPS=ON
```

## Build Troubleshooting (Linux)
Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y cmake g++ libcurl4-openssl-dev libssl-dev libsqlite3-dev \
  nlohmann-json3-dev libspdlog-dev
```

Fedora:
```bash
sudo dnf install -y cmake gcc-c++ libcurl-devel openssl-devel sqlite-devel \
  nlohmann-json-devel spdlog-devel
```

If cpp-httplib isn’t available via your package manager, enable FetchContent:
```bash
cmake -S . -B build -DKALSHI_FETCH_DEPS=ON
```

## Build Troubleshooting (Windows)
Recommended with vcpkg:
```powershell
vcpkg install curl openssl sqlite3 nlohmann-json spdlog cpp-httplib
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE=C:/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake
cmake --build build
```

## Notes on Auth
This project signs requests using RSA-PSS SHA256. The signature payload is constructed as:
`timestamp + method + path + body`.

If Kalshi updates its signing scheme, adjust `kalshi::KalshiClient::BuildAuthHeaders` accordingly.
