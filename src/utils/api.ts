import type { ApiResponse, Activity, Candidate, DrawRound, Winner, Danmaku, Blacklist, Group, OperationLog, User } from '../../shared/types';

const API_BASE = '/api';

async function request<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '请求失败',
        message: data.message,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    console.error('API Request Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () =>
      request('/auth/logout', {
        method: 'POST',
      }),
    me: () => request<User>('/auth/me'),
  },

  activities: {
    list: () => request<Activity[]>('/activities'),
    get: (id: string) => request<Activity>(`/activities/${id}`),
    create: (data: { name: string; description: string; password?: string }) =>
      request<Activity>('/activities', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<{ name: string; description: string; status: string; password?: string }>) =>
      request<Activity>(`/activities/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    start: (id: string) =>
      request<Activity>(`/activities/${id}/start`, { method: 'POST' }),
    end: (id: string) =>
      request<Activity>(`/activities/${id}/end`, { method: 'POST' }),
    archive: (id: string) =>
      request<Activity>(`/activities/${id}/archive`, { method: 'POST' }),
    unarchive: (id: string) =>
      request<Activity>(`/activities/${id}/unarchive`, { method: 'POST' }),
    importCandidates: (id: string, formData: FormData) =>
      request<{ imported: number }>(`/activities/${id}/import`, {
        method: 'POST',
        body: formData,
        headers: {},
      }),
  },

  candidates: {
    list: (activityId: string) => request<Candidate[]>(`/activities/${activityId}/candidates`),
    add: (activityId: string, data: { number: string; nickname?: string; groupId?: string }) =>
      request<Candidate>(`/activities/${activityId}/candidates`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (activityId: string, candidateId: string) =>
      request(`/activities/${activityId}/candidates/${candidateId}`, {
        method: 'DELETE',
      }),
  },

  rounds: {
    list: (activityId: string) => request<DrawRound[]>(`/activities/${activityId}/rounds`),
    create: (activityId: string, data: {
      name: string;
      drawCount: number;
      allowRepeat: boolean;
      mode: 'single' | 'multi';
    }) =>
      request<DrawRound>(`/activities/${activityId}/rounds`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (activityId: string, roundId: string, data: Partial<{
      name: string;
      drawCount: number;
      allowRepeat: boolean;
      mode: 'single' | 'multi';
      status: string;
    }>) =>
      request<DrawRound>(`/activities/${activityId}/rounds/${roundId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    draw: (activityId: string, roundId: string) =>
      request<{ winners: Winner[] }>(`/activities/${activityId}/rounds/${roundId}/draw`, {
        method: 'POST',
      }),
    redraw: (activityId: string, roundId: string, winnerId: string) =>
      request<{ winners: Winner[] }>(`/activities/${activityId}/rounds/${roundId}/redraw`, {
        method: 'POST',
        body: JSON.stringify({ winnerId }),
      }),
  },

  winners: {
    list: (activityId: string) => request<Winner[]>(`/activities/${activityId}/winners`),
  },

  danmaku: {
    list: (activityId: string) => request<Danmaku[]>(`/activities/${activityId}/danmaku`),
    send: (activityId: string, data: { content: string; senderNickname: string }) =>
      request<Danmaku>(`/activities/${activityId}/danmaku`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    approve: (activityId: string, danmakuId: string) =>
      request(`/activities/${activityId}/danmaku/${danmakuId}/approve`, {
        method: 'POST',
      }),
  },

  blacklist: {
    list: () => request<Blacklist[]>('/blacklist'),
    add: (data: { number: string; reason: string }) =>
      request<Blacklist>('/blacklist', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request(`/blacklist/${id}`, {
        method: 'DELETE',
      }),
  },

  groups: {
    list: (activityId: string) => request<Group[]>(`/activities/${activityId}/groups`),
    create: (activityId: string, data: { name: string; color: string }) =>
      request<Group>(`/activities/${activityId}/groups`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (activityId: string, groupId: string) =>
      request(`/activities/${activityId}/groups/${groupId}`, {
        method: 'DELETE',
      }),
  },

  logs: {
    list: (activityId: string) => request<OperationLog[]>(`/activities/${activityId}/logs`),
  },
};
