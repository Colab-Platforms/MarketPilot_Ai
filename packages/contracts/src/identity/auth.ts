import { z } from 'zod';
import { workspaceRoleSchema } from './roles';

export const PASSWORD_MIN_LENGTH = 10;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(128),
});

export const EMAIL_OTP_LENGTH = 6;

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^[0-9]{${EMAIL_OTP_LENGTH}}$`), `Enter the ${EMAIL_OTP_LENGTH}-digit code`),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const accountTypeSchema = z.enum(['creator', 'business']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const authContextSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    name: z.string(),
    emailVerified: z.boolean(),
  }),
  workspace: z.object({
    id: z.string().uuid(),
    name: z.string(),
    accountType: accountTypeSchema,
  }),
  role: workspaceRoleSchema,
});

export const authSessionResponseSchema = authContextSchema.extend({
  accessToken: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export type AuthContext = z.infer<typeof authContextSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
