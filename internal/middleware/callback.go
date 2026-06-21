package middleware

import (
	"crypto/rsa"
)

// storedPublicKey holds the parsed RSA public key set by main.go for use in callback handler
var storedPublicKey *rsa.PublicKey

func SetPublicKey(pub *rsa.PublicKey) {
	storedPublicKey = pub
}

func GetPublicKey() *rsa.PublicKey {
	return storedPublicKey
}

// VerifyRS256TokenForCallback verifies a token using the stored public key
func VerifyRS256TokenForCallback(tokenStr string, issuer string) (*ssoClaims, error) {
	if storedPublicKey == nil {
		return nil, ErrNoPublicKey
	}
	return verifyRS256Token(tokenStr, storedPublicKey, issuer)
}

var ErrNoPublicKey = &publicKeyError{"SSO 公钥未初始化"}

type publicKeyError struct{ msg string }

func (e *publicKeyError) Error() string { return e.msg }
