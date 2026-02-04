#include "utils/http_client.h"

#include <spdlog/spdlog.h>

#include <cstring>
#include <stdexcept>

namespace utils {

namespace {
size_t WriteBody(char *ptr, size_t size, size_t nmemb, void *userdata) {
  const size_t total = size * nmemb;
  auto *body = static_cast<std::string *>(userdata);
  body->append(ptr, total);
  return total;
}

size_t WriteHeader(char *buffer, size_t size, size_t nitems, void *userdata) {
  const size_t total = size * nitems;
  auto *headers = static_cast<std::map<std::string, std::string> *>(userdata);
  std::string line(buffer, total);

  auto colon = line.find(':');
  if (colon != std::string::npos) {
    std::string key = line.substr(0, colon);
    std::string value = line.substr(colon + 1);

    while (!value.empty() && (value.front() == ' ' || value.front() == '\t')) {
      value.erase(value.begin());
    }
    while (!value.empty() && (value.back() == '\r' || value.back() == '\n')) {
      value.pop_back();
    }
    (*headers)[key] = value;
  }

  return total;
}

}  // namespace

HttpClient::HttpClient() : curl_(curl_easy_init()) {
  if (!curl_) {
    throw std::runtime_error("Failed to init curl");
  }
}

HttpClient::~HttpClient() {
  if (curl_) {
    curl_easy_cleanup(curl_);
  }
}

HttpResponse HttpClient::Get(const std::string &url, const std::map<std::string, std::string> &headers) {
  return Execute(url, "GET", "", headers);
}

HttpResponse HttpClient::Post(const std::string &url,
                              const std::string &body,
                              const std::map<std::string, std::string> &headers) {
  return Execute(url, "POST", body, headers);
}

HttpResponse HttpClient::Execute(const std::string &url,
                                 const std::string &method,
                                 const std::string &body,
                                 const std::map<std::string, std::string> &headers) {
  HttpResponse response;
  std::string response_body;
  std::map<std::string, std::string> response_headers;

  curl_easy_reset(curl_);
  curl_easy_setopt(curl_, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl_, CURLOPT_CUSTOMREQUEST, method.c_str());
  curl_easy_setopt(curl_, CURLOPT_WRITEFUNCTION, WriteBody);
  curl_easy_setopt(curl_, CURLOPT_WRITEDATA, &response_body);
  curl_easy_setopt(curl_, CURLOPT_HEADERFUNCTION, WriteHeader);
  curl_easy_setopt(curl_, CURLOPT_HEADERDATA, &response_headers);
  curl_easy_setopt(curl_, CURLOPT_TIMEOUT, 20L);
  curl_easy_setopt(curl_, CURLOPT_FOLLOWLOCATION, 1L);

  struct curl_slist *header_list = nullptr;
  for (const auto &kv : headers) {
    std::string entry = kv.first + ": " + kv.second;
    header_list = curl_slist_append(header_list, entry.c_str());
  }
  if (header_list) {
    curl_easy_setopt(curl_, CURLOPT_HTTPHEADER, header_list);
  }

  if (method == "POST") {
    curl_easy_setopt(curl_, CURLOPT_POSTFIELDS, body.c_str());
    curl_easy_setopt(curl_, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
  }

  const CURLcode code = curl_easy_perform(curl_);
  if (code != CURLE_OK) {
    spdlog::error("HTTP {} {} failed: {}", method, url, curl_easy_strerror(code));
  }

  curl_easy_getinfo(curl_, CURLINFO_RESPONSE_CODE, &response.status);

  response.body = std::move(response_body);
  response.headers = std::move(response_headers);

  if (header_list) {
    curl_slist_free_all(header_list);
  }

  return response;
}

}  // namespace utils
