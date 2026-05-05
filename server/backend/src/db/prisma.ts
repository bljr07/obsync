import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}
