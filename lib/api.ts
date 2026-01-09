import type {
  MailingList,
  ThreadListResponse,
  ThreadDetailResponse,
} from "./types";

// Use local API routes to avoid CORS issues
const API_BASE_URL = "";

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all enabled mailing lists
 */
export async function getMailingLists(): Promise<MailingList[]> {
  return fetchApi<MailingList[]>("/api/mailing-lists");
}

/**
 * Fetch threads for a mailing list with pagination
 */
export async function getThreads(
  slug: string,
  page: number = 1,
  pageSize: number = 50
): Promise<ThreadListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  return fetchApi<ThreadListResponse>(`/api/lists/${slug}/threads?${params}`);
}

/**
 * Fetch thread details with all emails
 */
export async function getThread(
  slug: string,
  threadId: number
): Promise<ThreadDetailResponse> {
  return fetchApi<ThreadDetailResponse>(
    `/api/lists/${slug}/threads/${threadId}`
  );
}
