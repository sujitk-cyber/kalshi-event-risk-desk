cmake_minimum_required(VERSION 3.20)

project(kalshi_risk_desk LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG v0.15.3
)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)

FetchContent_Declare(
  spdlog
  GIT_REPOSITORY https://github.com/gabime/spdlog.git
  GIT_TAG v1.14.1
)

FetchContent_MakeAvailable(httplib nlohmann_json spdlog)

find_package(CURL REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(SQLite3 REQUIRED)

add_executable(kalshi_risk_desk
  src/main.cpp
  src/server/http_server.cpp
  src/kalshi/kalshi_client.cpp
  src/kalshi/kalshi_signer.cpp
  src/utils/http_client.cpp
  src/utils/env.cpp
  src/utils/base64.cpp
  src/storage/sqlite_store.cpp
  src/analytics/feature_engine.cpp
  src/analytics/alert_engine.cpp
)

target_include_directories(kalshi_risk_desk PRIVATE include)

target_link_libraries(kalshi_risk_desk
  PRIVATE
    CURL::libcurl
    OpenSSL::Crypto
    SQLite::SQLite3
    spdlog::spdlog
    nlohmann_json::nlohmann_json
    httplib::httplib
)

if (APPLE)
  target_compile_definitions(kalshi_risk_desk PRIVATE _DARWIN_C_SOURCE)
endif()
