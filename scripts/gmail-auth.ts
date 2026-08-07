/* eslint-disable no-restricted-syntax */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const credentialPath = process.argv[2];
const redirectUri =
  process.env.GMAIL_REDIRECT_URI ?? "http://localhost:6500/api/gmail-oauth/callback";

async function main() {
  if (!credentialPath) {
    console.error(
      "Usage: npm run gmail:auth -- ./client_secret_xxx.apps.googleusercontent.com.json",
    );
    process.exit(1);
  }

  const resolvedCredentialPath = path.resolve(process.cwd(), credentialPath);
  const credentials = JSON.parse(fs.readFileSync(resolvedCredentialPath, "utf8")) as {
    web?: {
      client_id?: string;
      client_secret?: string;
      redirect_uris?: string[];
    };
    installed?: {
      client_id?: string;
      client_secret?: string;
      redirect_uris?: string[];
    };
  };
  const clientConfig = credentials.web ?? credentials.installed;

  if (!clientConfig?.client_id || !clientConfig.client_secret) {
    console.error("Credential JSON tidak memiliki client_id/client_secret.");
    process.exit(1);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientConfig.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  console.log("\n1. Pastikan redirect URI ini sudah ditambahkan di Google Cloud OAuth Client:");
  console.log(`   ${redirectUri}`);
  console.log("\n2. Buka URL ini, login dengan Gmail pengirim, lalu approve:");
  console.log(`\n${authUrl.toString()}\n`);
  console.log("3. Setelah redirect gagal/masuk ke URL callback lokal, copy nilai query ?code=...");

  const rl = readline.createInterface({ input, output });
  const code = (await rl.question("\nPaste code: ")).trim();
  rl.close();

  if (!code) {
    console.error("Code kosong.");
    process.exit(1);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientConfig.client_id,
      client_secret: clientConfig.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenResponse.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok) {
    console.error(tokens.error_description ?? tokens.error ?? "Gagal menukar code OAuth.");
    process.exit(1);
  }

  if (!tokens.refresh_token) {
    console.error(
      "Google tidak mengembalikan refresh_token. Coba revoke akses app di Google Account, lalu jalankan lagi dengan prompt consent.",
    );
    process.exit(1);
  }

  console.log("\nTambahkan ke .env / Coolify env:");
  console.log("EMAIL_DRIVER=gmail_api");
  console.log(`GMAIL_CLIENT_ID=${clientConfig.client_id}`);
  console.log(`GMAIL_CLIENT_SECRET=${clientConfig.client_secret}`);
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GMAIL_REDIRECT_URI=${redirectUri}`);
  console.log("GMAIL_FROM=Nama Pengirim <alamat-gmail-yang-dipakai-login@gmail.com>");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
