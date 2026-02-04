#include "utils/env.h"

#include <cstdlib>

namespace utils {

std::string GetEnv(const std::string &key, const std::string &default_value) {
  const char *value = std::getenv(key.c_str());
  if (!value) {
    return default_value;
  }
  return std::string(value);
}

bool GetEnvBool(const std::string &key, bool default_value) {
  const std::string value = GetEnv(key, default_value ? "true" : "false");
  return value == "1" || value == "true" || value == "TRUE" || value == "yes" || value == "YES";
}

int GetEnvInt(const std::string &key, int default_value) {
  const std::string value = GetEnv(key, "");
  if (value.empty()) {
    return default_value;
  }
  return std::atoi(value.c_str());
}

}  // namespace utils
