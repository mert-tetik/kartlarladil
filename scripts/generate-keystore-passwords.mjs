import { writeFileSync } from "fs";
import { randomBytes } from "crypto";

const keystorePassword = randomBytes(16).toString("hex");
const keyPassword = randomBytes(16).toString("hex");

writeFileSync(
  ".keystore-passwords",
  `keystorePassword=${keystorePassword}\nkeyPassword=${keyPassword}\n`,
);

console.log("Generated .keystore-passwords");
