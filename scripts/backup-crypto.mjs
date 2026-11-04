import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MAGIC = Buffer.from("PCBK1", "ascii");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function usage() {
  throw new Error(
    "Uso: node scripts/backup-crypto.mjs encrypt <entrada.zip> <salida.pcbak> | decrypt <entrada.pcbak> <salida.zip> <contraseña>",
  );
}

function deriveKey(password, salt) {
  return scryptSync(password, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

const [operation, inputPath, outputPath, suppliedPassword] = process.argv.slice(2);
if (!operation || !inputPath || !outputPath) usage();

if (operation === "encrypt") {
  const password = randomBytes(32).toString("base64url");
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = readFileSync(inputPath);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  writeFileSync(outputPath, Buffer.concat([MAGIC, salt, iv, tag, ciphertext]));
  process.stdout.write(`${password}\n`);
} else if (operation === "decrypt") {
  if (!suppliedPassword) usage();
  const payload = readFileSync(inputPath);
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("El archivo no tiene formato Piel Canela Backup v1.");
  }
  let offset = MAGIC.length;
  const salt = payload.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;
  const iv = payload.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = payload.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const ciphertext = payload.subarray(offset);
  const key = deriveKey(suppliedPassword, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  writeFileSync(outputPath, plaintext);
} else {
  usage();
}
