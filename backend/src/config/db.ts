import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export const connectDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    console.log('[Database] PostgreSQL connected successfully');
    return true;
  } catch (error) {
    console.error('[Database] Connection failed:', (error as Error).message);
    return false;
  }
};
