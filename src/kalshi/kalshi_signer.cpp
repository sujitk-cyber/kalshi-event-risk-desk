#include "kalshi/kalshi_signer.h"

#include <openssl/pem.h>
#include <openssl/rsa.h>
#include <openssl/sha.h>

#include <stdexcept>

namespace kalshi {

KalshiSigner::KalshiSigner(const std::string &private_key_pem_path) {
  FILE *fp = fopen(private_key_pem_path.c_str(), "rb");
  if (!fp) {
    throw std::runtime_error("Failed to open private key file");
  }

  pkey_ = PEM_read_PrivateKey(fp, nullptr, nullptr, nullptr);
  fclose(fp);

  if (!pkey_) {
    throw std::runtime_error("Failed to load private key");
  }
}

KalshiSigner::~KalshiSigner() {
  if (pkey_) {
    EVP_PKEY_free(pkey_);
  }
}

std::string KalshiSigner::SignPssSha256(const std::string &payload) const {
  if (!pkey_) {
    throw std::runtime_error("Signer key not loaded");
  }

  EVP_MD_CTX *ctx = EVP_MD_CTX_new();
  if (!ctx) {
    throw std::runtime_error("Failed to create digest context");
  }

  size_t sig_len = 0;
  std::string signature;

  if (EVP_DigestSignInit(ctx, nullptr, EVP_sha256(), nullptr, pkey_) <= 0) {
    EVP_MD_CTX_free(ctx);
    throw std::runtime_error("DigestSignInit failed");
  }

  EVP_PKEY_CTX *pkey_ctx = EVP_MD_CTX_pkey_ctx(ctx);
  if (!pkey_ctx || EVP_PKEY_CTX_set_rsa_padding(pkey_ctx, RSA_PKCS1_PSS_PADDING) <= 0) {
    EVP_MD_CTX_free(ctx);
    throw std::runtime_error("Failed to set RSA-PSS padding");
  }

  if (EVP_PKEY_CTX_set_rsa_pss_saltlen(pkey_ctx, -1) <= 0) {
    EVP_MD_CTX_free(ctx);
    throw std::runtime_error("Failed to set RSA-PSS salt length");
  }

  if (EVP_DigestSignUpdate(ctx, payload.data(), payload.size()) <= 0) {
    EVP_MD_CTX_free(ctx);
    throw std::runtime_error("DigestSignUpdate failed");
  }

  if (EVP_DigestSignFinal(ctx, nullptr, &sig_len) <= 0) {
    EVP_MD_CTX_free(ctx);
    throw std::runtime_error("DigestSignFinal size failed");
  }

  signature.resize(sig_len);

  if (EVP_DigestSignFinal(ctx, reinterpret_cast<unsigned char *>(&signature[0]), &sig_len) <= 0) {
    EVP_MD_CTX_free(ctx);
    throw std::runtime_error("DigestSignFinal failed");
  }

  signature.resize(sig_len);
  EVP_MD_CTX_free(ctx);

  return signature;
}

}  // namespace kalshi
