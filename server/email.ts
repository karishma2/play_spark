export interface AuthEmailSender {
  sendPasswordReset(input: { to: string; resetUrl: string }): Promise<void>;
  sendEmailVerification(input: { to: string; verificationUrl: string }): Promise<void>;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendResendEmail(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Authentication email delivery failed.");
}

export function createResendAuthEmailSender(
  apiKey: string,
  from: string,
): AuthEmailSender {
  return {
    async sendPasswordReset({ to, resetUrl }) {
      const safeResetUrl = escapeHtml(resetUrl);
      await sendResendEmail(apiKey, {
        from,
        to: [to],
        subject: "Reset your Play Spark password",
        text: `Use this link to reset your Play Spark password. It expires in 30 minutes and can be used once:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Use the link below to reset your Play Spark password. It expires in 30 minutes and can be used once.</p><p><a href="${safeResetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    },
    async sendEmailVerification({ to, verificationUrl }) {
      const safeVerificationUrl = escapeHtml(verificationUrl);
      await sendResendEmail(apiKey, {
        from,
        to: [to],
        subject: "Verify your Play Spark email",
        text: `Verify your Play Spark email using this link. It expires in 24 hours and can be used once:\n\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`,
        html: `<p>Verify your Play Spark email using the link below. It expires in 24 hours and can be used once.</p><p><a href="${safeVerificationUrl}">Verify my email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
      });
    },
  };
}

export const unavailableAuthEmailSender: AuthEmailSender = {
  async sendPasswordReset() {
    throw new Error("Password reset email delivery is not configured.");
  },
  async sendEmailVerification() {
    throw new Error("Email verification delivery is not configured.");
  },
};
