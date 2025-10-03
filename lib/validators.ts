import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(80)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const productInputSchema = z.object({
  slug: z.string().min(3),
  title: z.string().min(3),
  description: z.string().min(10),
  priceCents: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
  sku: z.string().optional(),
  tags: z.array(z.string()).optional(),
  coverImageUrl: z.string().url().optional(),
  digitalFileUrl: z.string().url().optional()
});

export const serviceInputSchema = z.object({
  slug: z.string().min(3),
  title: z.string().min(3),
  description: z.string().min(10),
  basePriceCents: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional()
});

export const orderCreateSchema = z.object({
  type: z.enum(["digital", "service", "coaching"]),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        serviceId: z.string().uuid().optional(),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
});

export const paymentMockSchema = z.object({
  orderId: z.string().uuid()
});

export const requestCreateSchema = z.object({
  serviceId: z.string().uuid(),
  brief: z.record(z.any())
});

export const messageCreateSchema = z.object({
  body: z.string().min(1),
  attachments: z.array(z.string().url()).optional()
});

export const quoteCreateSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  notes: z.string().optional()
});

export const quoteResponseSchema = z.object({
  action: z.enum(["accept", "decline"])
});

export const deliverableCreateSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  fileUrl: z.string().url()
});

export const requestStatusSchema = z.object({
  status: z.enum([
    "open",
    "needs_info",
    "quoted",
    "paid",
    "in_progress",
    "delivered",
    "completed",
    "declined"
  ])
});

export const notificationReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(3),
  role: z.enum(["customer", "editor", "admin"]).optional()
});

export const adminUserCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(["customer", "editor", "admin"])
});

export const adminUserUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(2).optional(),
  role: z.enum(["customer", "editor", "admin"]).optional()
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional()
});
