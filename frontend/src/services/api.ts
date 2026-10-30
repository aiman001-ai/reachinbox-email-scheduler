import axios from 'axios';
import { EmailJob, EmailSchedulePayload, SlackStatus, QueueMetrics, UserProfile } from '../types';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://reachinbox-backend-91im.onrender.com/api'
    : 'http://localhost:4000/api');

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  scheduleEmails: async (payload: EmailSchedulePayload) => {
    const res = await client.post('/emails/schedule', payload);
    return res.data;
  },

  uploadLeadsFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post<{
      success: boolean;
      totalFound: number;
      emails: string[];
      fileName: string;
    }>('/emails/upload-leads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getScheduledEmails: async (params?: { search?: string; page?: number; limit?: number; userId?: string }) => {
    const res = await client.get<{
      total: number;
      page: number;
      totalPages: number;
      items: EmailJob[];
    }>('/emails/scheduled', { params });
    return res.data;
  },

  getSentEmails: async (params?: { search?: string; page?: number; limit?: number; userId?: string }) => {
    const res = await client.get<{
      total: number;
      page: number;
      totalPages: number;
      items: EmailJob[];
    }>('/emails/sent', { params });
    return res.data;
  },

  searchEmails: async (query: string, status?: string, userId?: string) => {
    const res = await client.get<{
      source: string;
      total: number | { value: number };
      results: EmailJob[];
    }>('/emails/search', { params: { q: query, status, userId } });
    return res.data;
  },

  getQueueStats: async () => {
    const res = await client.get<QueueMetrics>('/emails/stats');
    return res.data;
  },

  getSlackStatus: async (userId?: string) => {
    const res = await client.get<SlackStatus>('/slack/status', { params: { userId } });
    return res.data;
  },

  connectSlackWebhook: async (webhookUrl: string, channel?: string, userId?: string) => {
    const res = await client.post('/slack/connect-webhook', { webhookUrl, channel, userId });
    return res.data;
  },

  disconnectSlack: async (userId?: string) => {
    const res = await client.post('/slack/disconnect', { userId });
    return res.data;
  },

  triggerSlackTestAlert: async (sender: string, limit: number, userId?: string) => {
    const res = await client.post<{ success: boolean; message: string }>('/slack/test-alert', {
      sender,
      limit,
      userId,
    });
    return res.data;
  },

  syncUser: async (user: Partial<UserProfile>) => {
    const res = await client.post<{ success: boolean; user: UserProfile }>('/auth/sync', user);
    return res.data;
  },
};
