import { z } from 'zod';

export const candidateCredentials = z.object({
  action: z.enum(['login', 'register']),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12).max(72),
});
