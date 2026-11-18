export const QueueName = {
  Publishing: 'publishing',
  Generation: 'generation',
  Memory: 'memory',
  Analytics: 'analytics',
  Notifications: 'notifications',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];
