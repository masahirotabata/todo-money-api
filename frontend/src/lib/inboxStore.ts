// src/lib/inboxStore.ts
// InboxデータをサーバではなくlocalStorageに保存するローカルファースト実装

export type InboxStatus = "INBOX" | "PROCESSED";

export interface InboxItem {
  id: string;
  userId: number;
  title: string;
  memo?: string;
  targetDate?: string;
  status: InboxStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInboxRequest {
  userId: number;
  title: string;
  memo?: string;
  targetDate?: string;
}

export interface UpdateInboxRequest {
  title?: string;
  memo?: string;
  targetDate?: string;
}

function getCurrentUserKey() {
  const savedUserKey = localStorage.getItem("todoMoneyUserKey");
  if (savedUserKey) return savedUserKey;

  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(
      payload.email ?? payload.sub ?? payload.userId ?? payload.id ?? "user"
    );
  } catch {
    return "user";
  }
}

function inboxKey() {
  return `todo-money:inbox:v1:${getCurrentUserKey()}`;
}

function loadInbox(): InboxItem[] {
  try {
    const raw = localStorage.getItem(inboxKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveInbox(list: InboxItem[]) {
  localStorage.setItem(inboxKey(), JSON.stringify(list));
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function getInboxItems(_userId?: number): Promise<InboxItem[]> {
  return loadInbox().filter((item) => item.status === "INBOX");
}

export async function createInboxItem(
  request: CreateInboxRequest
): Promise<InboxItem> {
  const now = new Date().toISOString();

  const item: InboxItem = {
    id: uid(),
    userId: request.userId,
    title: request.title,
    memo: request.memo,
    targetDate: request.targetDate,
    status: "INBOX",
    createdAt: now,
    updatedAt: now,
  };

  const list = loadInbox();
  list.push(item);
  saveInbox(list);

  return item;
}

export async function updateInboxItem(
  id: string,
  request: UpdateInboxRequest
): Promise<InboxItem> {
  const list = loadInbox();
  const index = list.findIndex((item) => item.id === id);

  if (index === -1) {
    throw { status: 404, message: "Inboxアイテムが見つかりません。" };
  }

  const updated: InboxItem = {
    ...list[index],
    ...request,
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveInbox(list);

  return updated;
}

export async function markInboxProcessed(id: string): Promise<InboxItem> {
  const list = loadInbox();
  const index = list.findIndex((item) => item.id === id);

  if (index === -1) {
    throw { status: 404, message: "Inboxアイテムが見つかりません。" };
  }

  const updated: InboxItem = {
    ...list[index],
    status: "PROCESSED",
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveInbox(list);

  return updated;
}

export async function deleteInboxItem(id: string): Promise<void> {
  const list = loadInbox();
  const next = list.filter((item) => item.id !== id);
  saveInbox(next);
}
