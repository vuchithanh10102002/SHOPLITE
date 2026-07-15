import { z } from "zod";

/**
 * Payload cua job di qua Redis duoi dang JSON — no roi khoi bien gioi type cua TS.
 * Worker la mot process KHAC, co the dang chay code phien ban CU hon API (deploy
 * lech nhau vai giay). Nen job doc tu queue phai duoc validate y het request HTTP:
 * du lieu tu ben ngoai, khong tin duoc.
 */
export const emailJobSchemas = {
  "verify-email": z.object({
    email: z.string().email(),
    fullName: z.string(),
    token: z.string().min(1),
    requestId: z.string().optional(),
  }),

  "reset-password": z.object({
    email: z.string().email(),
    fullName: z.string(),
    token: z.string().min(1),
    requestId: z.string().optional(),
  }),

  // order-status chi mang orderId, KHONG mang san trang thai/tong tien.
  // Job co the chay lai sau vai giay (retry) — luc do snapshot trong payload da cu.
  // Worker tu doc DB → email luon phan anh trang thai THAT tai luc gui.
  "order-status": z.object({
    orderId: z.string().uuid(),
    requestId: z.string().optional(),
  }),
} as const;

export type EmailJobName = keyof typeof emailJobSchemas;

export type EmailJobDataMap = {
  [K in EmailJobName]: z.infer<(typeof emailJobSchemas)[K]>;
};

export type EmailJobData = EmailJobDataMap[EmailJobName];

export const EMAIL_JOB_NAMES = Object.keys(emailJobSchemas) as EmailJobName[];

export function isEmailJobName(name: string): name is EmailJobName {
  return name in emailJobSchemas;
}
