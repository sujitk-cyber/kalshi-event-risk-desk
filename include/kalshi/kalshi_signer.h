#pragma once

#include <openssl/evp.h>

#include <string>
#include <vector>

namespace kalshi {

class KalshiSigner {
 public:
  explicit KalshiSigner(const std::string &private_key_pem_path);
  ~KalshiSigner();

  std::string SignPssSha256(const std::string &payload) const;

 private:
  EVP_PKEY *pkey_ = nullptr;
};

}  // namespace kalshi
