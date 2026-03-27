import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !portRaw) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT inválido");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      ciphers: "SSLv3",
    },
  });

  return cachedTransporter;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM?.trim();

  if (!transporter || !from) {
    console.info(
      `[mail:dev-fallback] Para=${payload.to} Asunto=${payload.subject} Contenido=${payload.text}`,
    );
    return;
  }

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}