import { esClient, getEsConnectionStatus } from '../config/elasticsearch';
import { config } from '../config/env';
import { prisma } from '../config/db';

export interface EmailDocument {
  id: string;
  userId?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}

export class SearchService {
  public static async indexEmail(email: EmailDocument): Promise<void> {
    if (!getEsConnectionStatus()) {
      return;
    }

    try {
      await esClient.index({
        index: config.elasticsearch.index,
        id: email.id,
        document: {
          id: email.id,
          userId: email.userId || null,
          sender: email.sender,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt.toISOString(),
          sentAt: email.sentAt ? email.sentAt.toISOString() : null,
          createdAt: email.createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.warn(`[SearchService] Indexing error for ${email.id}:`, (error as Error).message);
    }
  }

  public static async searchEmails(query: string, filters: { userId?: string; status?: string }) {
    const trimmed = query.trim();

    if (getEsConnectionStatus() && trimmed.length > 0) {
      try {
        const mustClauses: any[] = [
          {
            multi_match: {
              query: trimmed,
              fields: ['recipient^3', 'subject^2', 'body', 'sender'],
              fuzziness: 'AUTO',
            },
          },
        ];

        if (filters.userId) {
          mustClauses.push({ term: { userId: filters.userId } });
        }
        if (filters.status) {
          mustClauses.push({ term: { status: filters.status } });
        }

        const response = await esClient.search({
          index: config.elasticsearch.index,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          size: 50,
        });

        const hits = response.hits.hits.map((hit) => hit._source);
        return {
          source: 'elasticsearch',
          total: response.hits.total,
          results: hits,
        };
      } catch (error) {
        console.warn('[SearchService] ES search failed, falling back to DB:', (error as Error).message);
      }
    }

    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;

    if (trimmed.length > 0) {
      where.OR = [
        { recipient: { contains: trimmed } },
        { subject: { contains: trimmed } },
        { sender: { contains: trimmed } },
        { body: { contains: trimmed } },
      ];
    }

    const results = await prisma.emailJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      source: 'database',
      total: results.length,
      results,
    };
  }
}
