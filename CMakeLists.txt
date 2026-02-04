cmake_minimum_required(VERSION 3.20)

project(kalshi_risk_desk LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

option(KALSHI_PREFER_SYSTEM_DEPS "Prefer system-installed dependencies" ON)
option(KALSHI_FETCH_DEPS "Allow FetchContent downloads for dependencies" ON)

if (KALSHI_PREFER_SYSTEM_DEPS)
  find_package(nlohmann_json CONFIG QUIET)
  find_package(spdlog CONFIG QUIET)
  find_package(httplib CONFIG QUIET)
  if (NOT TARGET httplib::httplib)
    find_package(cpp-httplib CONFIG QUIET)
    if (TARGET cpp-httplib::cpp-httplib)
      add_library(httplib::httplib ALIAS cpp-httplib::cpp-httplib)
    endif()
  endif()
endif()

if (KALSHI_FETCH_DEPS)
  if (NOT TARGET httplib::httplib)
    FetchContent_Declare(
      httplib
      GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
      GIT_TAG v0.15.3
    )
  endif()

  if (NOT TARGET nlohmann_json::nlohmann_json)
    FetchContent_Declare(
      nlohmann_json
      GIT_REPOSITORY https://github.com/nlohmann/json.git
      GIT_TAG v3.11.3
    )
  endif()

  if (NOT TARGET spdlog::spdlog)
    FetchContent_Declare(
      spdlog
      GIT_REPOSITORY https://github.com/gabime/spdlog.git
      GIT_TAG v1.14.1
    )
  endif()

  FetchContent_MakeAvailable(httplib nlohmann_json spdlog)
endif()

if (NOT TARGET httplib::httplib)
  message(FATAL_ERROR "Missing dependency: cpp-httplib. Install it or set KALSHI_FETCH_DEPS=ON.")
endif()
if (NOT TARGET nlohmann_json::nlohmann_json)
  message(FATAL_ERROR "Missing dependency: nlohmann_json. Install it or set KALSHI_FETCH_DEPS=ON.")
endif()
if (NOT TARGET spdlog::spdlog)
  message(FATAL_ERROR "Missing dependency: spdlog. Install it or set KALSHI_FETCH_DEPS=ON.")
endif()

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
