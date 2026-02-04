#pragma once

#include <curl/curl.h>

#include <map>
#include <memory>
#include <string>

namespace utils {

struct HttpResponse {
  long status = 0;
  std::string body;
  std::map<std::string, std::string> headers;
};

class HttpClient {
 public:
  HttpClient();
  ~HttpClient();

  HttpResponse Get(const std::string &url, const std::map<std::string, std::string> &headers = {});
  HttpResponse Post(const std::string &url,
                    const std::string &body,
                    const std::map<std::string, std::string> &headers = {});

 private:
  CURL *curl_;
  HttpResponse Execute(const std::string &url,
                       const std::string &method,
                       const std::string &body,
                       const std::map<std::string, std::string> &headers);
};

}  // namespace utils
