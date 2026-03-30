import crypto from "node:crypto";

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function validateTelegramWebAppData(
  initData: string,
  botToken: string,
): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const hmac = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    return timingSafeEqualHex(hmac, hash);
  } catch {
    return false;
  }
}

export function parseUserFromInitData(initData: string): {
  id: bigint;
  firstName?: string;
} | null {
  const params = new URLSearchParams(initData);
  const raw = params.get("user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { id: number; first_name?: string };
    return { id: BigInt(u.id), firstName: u.first_name };
  } catch {
    return null;
  }
}
