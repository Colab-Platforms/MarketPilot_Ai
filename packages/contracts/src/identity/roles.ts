import { z } from 'zod';

export const workspaceRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'creator',
  'approver',
  'analyst',
  'client',
]);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
