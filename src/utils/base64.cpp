#include "utils/base64.h"

#include <openssl/bio.h>
#include <openssl/evp.h>
#include <openssl/buffer.h>

namespace utils {

std::string Base64Encode(const std::string &input) {
  BIO *bio = BIO_new(BIO_s_mem());
  BIO *b64 = BIO_new(BIO_f_base64());
  BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
  bio = BIO_push(b64, bio);

  BIO_write(bio, input.data(), static_cast<int>(input.size()));
  BIO_flush(bio);

  BUF_MEM *buffer = nullptr;
  BIO_get_mem_ptr(bio, &buffer);
  std::string output(buffer->data, buffer->length);

  BIO_free_all(bio);
  return output;
}

}  // namespace utils
