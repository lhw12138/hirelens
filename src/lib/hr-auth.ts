import {z} from 'zod';
import {accountPasswordError} from './password-policy';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().max(72);
const registrationPassword = password.min(8).superRefine((value, context) => {
  const message = accountPasswordError(value);
  if (message) context.addIssue({code: 'custom', message});
});

export const hrCredentials = z.discriminatedUnion('action', [
  z.object({action: z.literal('login'), email, password: password.min(1)}),
  z.object({action: z.literal('register'), email, password: registrationPassword}),
]);
