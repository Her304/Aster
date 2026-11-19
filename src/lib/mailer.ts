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

const milestoneCopy: Record<MailLocale, { subject: Record<number, string>; body: (level: number, total: number, link: string) => string }> = {
  en: {
    subject: { 3: "Your Aster ranking is open", 5: "Your question-by-question comparison is open", 8: "Your view by relationship is open" },
    body: (level, total, link) =>
      `${total} people have answered your survey, so ${level === 3 ? "the ranking is now open to everyone who answered" : level === 5 ? "your report now compares your answers with theirs, question by question" : "your report now shows how each kind of relationship sees you"}.\n\nSee it here: ${link}\n\nYou can turn these emails off on your survey page.`,
  },
  "zh-Hant": {
    subject: { 3: "你的 Aster 排行已公開", 5: "逐題比較已解鎖", 8: "依關係分組已解鎖" },
    body: (level, total, link) =>
      `已經有 ${total} 人回答你的問卷，${level === 3 ? "排行現在已向所有作答者公開" : level === 5 ? "報告現在可以逐題比較你和他們的答案" : "報告現在可以看出不同關係的人怎麼看你"}。\n\n前往查看：${link}\n\n你可以在問卷頁面關閉這些通知信。`,
  },
  ja: {
    subject: { 3: "Aster のランキングが公開されました", 5: "質問ごとの比較が解放されました", 8: "関係別の見え方が解放されました" },
    body: (level, total, link) =>
      `アンケートに${total}人が回答しました。${level === 3 ? "回答した人みんながランキングを見られるようになりました" : level === 5 ? "レポートで、あなたと友だちの回答を質問ごとに比べられるようになりました" : "レポートで、関係ごとの見え方がわかるようになりました"}。\n\nこちらから見られます：${link}\n\nこのメールはアンケートのページで止められます。`,
  },
  ko: {
    subject: { 3: "Aster 순위가 공개됐어요", 5: "문항별 비교가 열렸어요", 8: "관계별로 보기가 열렸어요" },
    body: (level, total, link) =>
      `설문에 ${total}명이 답했어요. ${level === 3 ? "이제 응답한 모두가 순위를 볼 수 있어요" : level === 5 ? "이제 리포트에서 내 답과 친구들의 답을 문항별로 비교할 수 있어요" : "이제 리포트에서 관계별로 나를 어떻게 보는지 볼 수 있어요"}.\n\n여기서 확인하세요: ${link}\n\n이 메일은 설문 페이지에서 끌 수 있어요.`,
  },
};

/**
 * Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set. Outside
 * production, with neither set, the message is printed to the server console
 * so it can be tried locally.
 */
async function sendEmail(to: string, subject: string, text: string) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`[aster] email to ${to}: ${subject}\n${text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}.`);
}

export async function sendSignInCode(email: string, code: string, locale: MailLocale) {
  const message = copy[locale];
  const body = message.body(code);
  if (!emailConfigured() && process.env.NODE_ENV !== "production") {
    console.info(`[aster] sign-in code for ${email}: ${code}`);
    return;
  }
  await sendEmail(email, message.subject, body);
}

export async function sendMilestone(email: string, level: number, total: number, link: string, locale: MailLocale) {
  const message = milestoneCopy[locale];
  await sendEmail(email, message.subject[level], message.body(level, total, link));
}
