#pragma once

#include <string>

namespace utils {

std::string GetEnv(const std::string &key, const std::string &default_value = "");
bool GetEnvBool(const std::string &key, bool default_value = false);
int GetEnvInt(const std::string &key, int default_value = 0);

}
