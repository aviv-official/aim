const secretbox = nacl.secretbox;
const randomBytes = nacl.randomBytes;
const decodeUTF8 = nacl.util.decodeUTF8;
const encodeUTF8 = nacl.util.encodeUTF8;
const encodeBase64 = nacl.util.encodeBase64;
const decodeBase64 = nacl.util.decodeBase64;

const newNonce = () => randomBytes(secretbox.nonceLength);

export const generateKey = () => encodeBase64(randomBytes(secretbox.keyLength));

export const encrypt = (json, key) => {
  console.log("Encrypting ",json," with ",key);
  let keyUint8Array = decodeBase64(key);
  if(keyUint8Array.length > secretbox.keyLength){
    keyUint8Array = keyUint8Array.slice(0,secretbox.keyLength);
  }
  console.log("key length is ",keyUint8Array.length);
  const nonce = newNonce();
  const messageUint8 = decodeUTF8(JSON.stringify(json));
  const box = secretbox(messageUint8, nonce, keyUint8Array);

  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);

  const base64FullMessage = encodeBase64(fullMessage);
  return base64FullMessage;
};

export const decrypt = (messageWithNonce, key) => {
  let keyUint8Array = decodeBase64(key);
  if(keyUint8Array.length > secretbox.keyLength){
    keyUint8Array = keyUint8Array.slice(0,secretbox.keyLength);
  }
  const messageWithNonceAsUint8Array = decodeBase64(messageWithNonce);
  const nonce = messageWithNonceAsUint8Array.slice(0, secretbox.nonceLength);
  const message = messageWithNonceAsUint8Array.slice(
    secretbox.nonceLength,
    messageWithNonce.length
  );

  const decrypted = secretbox.open(message, nonce, keyUint8Array);

  if (!decrypted) {
    throw new Error("Could not decrypt message");
  }

  const base64DecryptedMessage = encodeUTF8(decrypted);
  return JSON.parse(base64DecryptedMessage);
};