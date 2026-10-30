import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const esClient = new Client({
  node: config.elasticsearch.node,
});

let isEsConnected = false;

export const initElasticsearch = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health({}, { requestTimeout: 3000 });
    console.log(`[Elasticsearch] Connected. Cluster status: ${health.status}`);
    isEsConnected = true;

    const indexExists = await esClient.indices.exists({
      index: config.elasticsearch.index,
    });

    if (!indexExists) {
      await esClient.indices.create({
        index: config.elasticsearch.index,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            sender: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Created index: ${config.elasticsearch.index}`);
    }

    return true;
  } catch (error) {
    isEsConnected = false;
    console.warn(`[Elasticsearch] Service not reachable at ${config.elasticsearch.node}. Database fallback will be used.`);
    return false;
  }
};

export const getEsConnectionStatus = () => isEsConnected;
