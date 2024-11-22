/* eslint-disable unicorn/prefer-code-point */

const decryptKey = (): string => {
  const _a = [126, 225, 237, 227, 217, 208, 196, 192, 195, 197, 148, 99, 101, 146, 215, 237, 227, 226, 221, 212, 224]

  let _e = String.fromCharCode(_a[0] - _a.length)

  for (let n = 1; n < _a.length; n++) {
    _e += String.fromCharCode(_a[n] - _e.charCodeAt(n - 1))
  }

  return _e.slice(0, 6)
}

const decryptQuestion = (question: string, key: string): string => {
  return CryptoJS.AES.decrypt(question, key).toString(CryptoJS.enc.Utf8).slice(13)
}

export default {decryptKey, decryptQuestion}
