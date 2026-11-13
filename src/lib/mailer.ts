type MailLocale = "en" | "zh-Hant" | "ja" | "ko";

const copy: Record<MailLocale, { subject: string; body: (code: string) => string }> = {
  en: {
    subject: "Your Aster sign-in code",
    body: (code) => `Your Aster sign-in code is ${code}.\n\nIt works once and expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
  },
  "zh-Hant": {
    subject: "你的 Aster 登入驗證碼",
    body: (code) => `你的 Aster 登入驗證碼是 ${code}。\n\n此驗證碼只能使用一次，10 分鐘後失效。如果這不是你本人的請求，請忽略這封郵件。`,
  },
  ja: {
    subject: "Aster のサインインコード",
    body: (code) => `Aster のサインインコードは ${code} です。\n\n一度だけ使え、10分で無効になります。お心当たりがない場合は、このメールを無視してください。`,
  },
  ko: {
    subject: "Aster 로그인 코드",
    body: (code) => `Aster 로그인 코드는 ${code}입니다.\n\n한 번만 사용할 수 있으며 10분 후 만료됩니다. 요청한 적이 없다면 이 메일을 무시하세요.`,
  },
};

export function mailLocale(input: unknown): MailLocale {
  return input === "zh-Hant" || input === "ja" || input === "ko" ? input : "en";
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set. Outside
 * production, with neither set, the code is printed to the server console so
 * sign-in can be tried locally.
 */
export async function sendSignInCode(email: string, code: string, locale: MailLocale) {
  const message = copy[locale];
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`[aster] sign-in code for ${email}: ${code}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: message.subject, text: message.body(code) }),
  });
  if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}.`);
}
