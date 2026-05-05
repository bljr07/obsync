import { getPrismaClient } from "./prisma.js";

const prisma = getPrismaClient();

export type CreateUserInput = {
  username: string;
  passwordHash: string;
  role: string;
  mustChangePassword: boolean;
};

export async function createUser(input: CreateUserInput) {
  return prisma.user.create({
    data: {
      username: input.username,
      passwordHash: input.passwordHash,
      role: input.role,
      mustChangePassword: input.mustChangePassword
    }
  });
}

export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username }
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id }
  });
}

export async function countUsers() {
  return prisma.user.count();
}

export async function updateUserCredentials(options: {
  id: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
}) {
  return prisma.user.update({
    where: { id: options.id },
    data: {
      username: options.username,
      passwordHash: options.passwordHash,
      mustChangePassword: options.mustChangePassword
    }
  });
}
