import { milestoneEmailHtml, signInEmailHtml, type MilestoneEmailCopy, type SignInEmailCopy } from "./email-template";

type MailLocale = "en" | "zh-Hant" | "ja" | "ko";

const signInCopy: Record<MailLocale, (code: string) => SignInEmailCopy> = {
  en: (code) => ({
    lang: "en",
    subject: "Your Aster sign-in code",
    preheader: `Your code is ${code}. It expires in 10 minutes.`,
    eyebrow: "Your sign-in code",
    heading: "Here’s your code.",
    intro: "Enter these six digits on Aster to sign in.",
    expiry: "It works once and expires in 10 minutes.",
    ignore: "If you didn’t ask for it, you can ignore this email. Nobody can sign in without the code.",
    tagline: "Aster · See yourself through your friends",
  }),
  "zh-Hant": (code) => ({
    lang: "zh-Hant",
    subject: "你的 Aster 登入驗證碼",
    preheader: `你的驗證碼是 ${code}，10 分鐘後失效。`,
    eyebrow: "你的登入驗證碼",
    heading: "這是你的驗證碼。",
    intro: "在 Aster 輸入這六位數字即可登入。",
    expiry: "此驗證碼只能使用一次，10 分鐘後失效。",
    ignore: "如果這不是你本人的請求，請忽略這封郵件。沒有驗證碼，任何人都無法登入。",
    tagline: "Aster · 透過朋友的眼睛看見自己",
  }),
  ja: (code) => ({
    lang: "ja",
    subject: "Aster のサインインコード",
    preheader: `コードは ${code} です。10分で無効になります。`,
    eyebrow: "サインインコード",
    heading: "あなたのコードです。",
    intro: "Aster でこの6桁の数字を入力するとサインインできます。",
    expiry: "一度だけ使え、10分で無効になります。",
    ignore: "お心当たりがない場合は、このメールを無視してください。コードがなければ誰もサインインできません。",
    tagline: "Aster · 友だちの目に映る自分を知る",
  }),
  ko: (code) => ({
    lang: "ko",
    subject: "Aster 로그인 코드",
    preheader: `코드는 ${code}입니다. 10분 후 만료돼요.`,
    eyebrow: "로그인 코드",
    heading: "로그인 코드예요.",
    intro: "Aster에서 이 여섯 자리 숫자를 입력하면 로그인돼요.",
    expiry: "한 번만 사용할 수 있으며 10분 후 만료됩니다.",
    ignore: "요청한 적이 없다면 이 메일을 무시하세요. 코드 없이는 누구도 로그인할 수 없어요.",
    tagline: "Aster · 친구들의 눈으로 나를 보다",
  }),
};

type Level = 3 | 5 | 8 | 10;

const milestoneCopy: Record<MailLocale, (level: Level, total: number) => MilestoneEmailCopy> = {
  en: (level, total) => ({
    lang: "en",
    subject: { 3: "Your Aster ranking is open", 5: "Your question-by-question comparison is open", 8: "Your view by relationship is open", 10: "Your friends’ flowers have bloomed" }[level],
    preheader: `${total} people have answered your survey.`,
    eyebrow: "News from your survey",
    lede: `${total} people have answered your survey, so ${{ 3: "the ranking is now open to everyone who answered", 5: "your report now compares your answers with theirs, question by question", 8: "your report now shows how each kind of relationship sees you", 10: "everyone who answered has earned a flower for how closely they see you as you see yourself, each with its own meaning in the language of flowers" }[level]}.`,
    cta: "See your report",
    turnOff: "You can turn these emails off on your survey page.",
    tagline: "Aster · See yourself through your friends",
  }),
  "zh-Hant": (level, total) => ({
    lang: "zh-Hant",
    subject: { 3: "你的 Aster 排行已公開", 5: "逐題比較已解鎖", 8: "依關係分組已解鎖", 10: "朋友們的花開了" }[level],
    preheader: `已經有 ${total} 人回答你的問卷。`,
    eyebrow: "你的問卷有新進展",
    lede: `已經有 ${total} 人回答你的問卷，${{ 3: "排行現在已向所有作答者公開", 5: "報告現在可以逐題比較你和他們的答案", 8: "報告現在可以看出不同關係的人怎麼看你", 10: "每位作答者都依照他們眼中的你和你眼中的自己有多相符，得到了一朵花，每朵花都有自己的花語" }[level]}。`,
    cta: "查看報告",
    turnOff: "你可以在問卷頁面關閉這些通知信。",
    tagline: "Aster · 透過朋友的眼睛看見自己",
  }),
  ja: (level, total) => ({
    lang: "ja",
    subject: { 3: "Aster のランキングが公開されました", 5: "質問ごとの比較が解放されました", 8: "関係別の見え方が解放されました", 10: "友だちの花が咲きました" }[level],
    preheader: `アンケートに${total}人が回答しました。`,
    eyebrow: "アンケートのお知らせ",
    lede: `アンケートに${total}人が回答しました。${{ 3: "回答した人みんながランキングを見られるようになりました", 5: "レポートで、あなたと友だちの回答を質問ごとに比べられるようになりました", 8: "レポートで、関係ごとの見え方がわかるようになりました", 10: "回答した人それぞれに、あなたの自己認識とどれだけ近いかで花が贈られました。花にはそれぞれの花言葉があります" }[level]}。`,
    cta: "レポートを見る",
    turnOff: "このメールはアンケートのページで止められます。",
    tagline: "Aster · 友だちの目に映る自分を知る",
  }),
  ko: (level, total) => ({
    lang: "ko",
    subject: { 3: "Aster 순위가 공개됐어요", 5: "문항별 비교가 열렸어요", 8: "관계별로 보기가 열렸어요", 10: "친구들의 꽃이 피었어요" }[level],
    preheader: `설문에 ${total}명이 답했어요.`,
    eyebrow: "설문 소식",
    lede: `설문에 ${total}명이 답했어요. ${{ 3: "이제 응답한 모두가 순위를 볼 수 있어요", 5: "이제 리포트에서 내 답과 친구들의 답을 문항별로 비교할 수 있어요", 8: "이제 리포트에서 관계별로 나를 어떻게 보는지 볼 수 있어요", 10: "응답한 사람마다 내가 보는 나와 얼마나 비슷하게 보는지에 따라 꽃을 받았어요. 꽃마다 꽃말이 있어요" }[level]}.`,
    cta: "리포트 보기",
    turnOff: "이 메일은 설문 페이지에서 끌 수 있어요.",
    tagline: "Aster · 친구들의 눈으로 나를 보다",
  }),
};

export function mailLocale(input: unknown): MailLocale {
  return input === "zh-Hant" || input === "ja" || input === "ko" ? input : "en";
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

interface Message {
  subject: string;
  text: string;
  html: string;
}

export function signInMessage(code: string, locale: MailLocale, origin: string): Message {
  const copy = signInCopy[locale](code);
  return {
    subject: copy.subject,
    text: `${copy.heading}\n\n${code}\n\n${copy.intro} ${copy.expiry}\n\n${copy.ignore}`,
    html: signInEmailHtml(copy, code, origin),
  };
}

export function milestoneMessage(level: number, total: number, link: string, locale: MailLocale, origin: string): Message {
  const copy = milestoneCopy[locale](level as Level, total);
  return {
    subject: copy.subject,
    text: `${copy.lede}\n\n${copy.cta}: ${link}\n\n${copy.turnOff}`,
    html: milestoneEmailHtml(copy, link, origin),
  };
}

/**
 * Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set. Outside
 * production, with neither set, the message is printed to the server console
 * so it can be tried locally.
 */
async function sendEmail(to: string, message: Message) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`[aster] email to ${to}: ${message.subject}\n${message.text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}.`);
}

export async function sendSignInCode(email: string, code: string, locale: MailLocale, origin: string) {
  if (!emailConfigured() && process.env.NODE_ENV !== "production") {
    console.info(`[aster] sign-in code for ${email}: ${code}`);
    return;
  }
  await sendEmail(email, signInMessage(code, locale, origin));
}

export async function sendMilestone(email: string, level: number, total: number, link: string, locale: MailLocale) {
  await sendEmail(email, milestoneMessage(level, total, link, locale, new URL(link).origin));
}
