import { z } from "zod";

export const notificationSchema = z.object({
  playerId: z.string().min(1),
  assetId: z.string().min(1),
  event: z.enum(["asset_published", "asset_flagged"]),
  moderationQueue: z.string().min(1),
  subscribers: z.array(z.object({ id: z.string(), optedIn: z.boolean() }))
});

export type Notification = z.infer<typeof notificationSchema>;

export function fanout(notification: Notification) {
  const recipients = notification.subscribers.filter((subscriber) => subscriber.optedIn).map(({ id }) => id);
  return { ...notification, recipients, recipientCount: recipients.length };
}
