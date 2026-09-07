const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';

export interface NotionProperty {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface NotionPage {
  id: string;
  created_time?: string;
  last_edited_time?: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionDataSource {
  properties: Record<string, { id?: string; type?: string }>;
}

interface QueryResponse {
  results: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
}

export class NotionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}

export const notionRequest = async <T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : `Notion API 请求失败 (${response.status})`;
    throw new NotionApiError(message, response.status, body);
  }
  return body as T;
};

export const retrieveDataSource = (dataSourceId: string, token: string) =>
  notionRequest<NotionDataSource>(`/data_sources/${dataSourceId}`, token);

export const queryDataSource = async (
  dataSourceId: string,
  token: string,
  body: Record<string, unknown>,
): Promise<NotionPage[]> => {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionRequest<QueryResponse>(
      `/data_sources/${dataSourceId}/query`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ ...body, ...(cursor ? { start_cursor: cursor } : {}), page_size: 100 }),
      },
    );
    pages.push(...response.results);
    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
};

export const updatePageProperties = (
  pageId: string,
  token: string,
  properties: Record<string, unknown>,
) => notionRequest<NotionPage>(`/pages/${pageId}`, token, {
  method: 'PATCH',
  body: JSON.stringify({ properties }),
});

const richText = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  return value.map((item) => {
    if (!item || typeof item !== 'object') return '';
    if ('plain_text' in item) return String(item.plain_text ?? '');
    if ('text' in item && item.text && typeof item.text === 'object' && 'content' in item.text) {
      return String(item.text.content ?? '');
    }
    return '';
  }).join('');
};

export const propertyString = (property?: NotionProperty): string => {
  if (!property) return '';
  const type = property.type;
  const value = type ? property[type] : undefined;
  if (type === 'title' || type === 'rich_text') return richText(value);
  if ((type === 'select' || type === 'status') && value && typeof value === 'object' && 'name' in value) {
    return String(value.name ?? '');
  }
  if (type === 'url' || type === 'email' || type === 'phone_number') return String(value ?? '');
  if (type === 'string') return String(value ?? '');
  if (type === 'boolean') return value == null ? '' : String(value);
  if (type === 'number') return value == null ? '' : String(value);
  if (type === 'date' && value && typeof value === 'object' && 'start' in value) return String(value.start ?? '');
  if (type === 'relation' && Array.isArray(value)) {
    return value.map((item) => item && typeof item === 'object' && 'id' in item ? String(item.id) : '').filter(Boolean).join(',');
  }
  if (type === 'files' && Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object') {
      if ('external' in first && first.external && typeof first.external === 'object' && 'url' in first.external) return String(first.external.url);
      if ('file' in first && first.file && typeof first.file === 'object' && 'url' in first.file) return String(first.file.url);
    }
  }
  if (type === 'formula' && value && typeof value === 'object' && 'type' in value) {
    const formula = value as NotionProperty;
    if (formula.type === 'date' && formula.date && typeof formula.date === 'object' && 'start' in formula.date) return String(formula.date.start ?? '');
    return propertyString(formula);
  }
  if (type === 'rollup' && value && typeof value === 'object') {
    if ('number' in value) return value.number == null ? '' : String(value.number);
    if ('array' in value && Array.isArray(value.array)) return value.array.map((item) => propertyString(item as NotionProperty)).join(',');
  }
  return '';
};

export const propertyNumber = (property?: NotionProperty): number | undefined => {
  if (!property) return undefined;
  const raw = property.type === 'number' ? property.number : propertyString(property);
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(value) ? value : undefined;
};

export const propertyBoolean = (property?: NotionProperty): boolean | undefined => {
  if (!property) return undefined;
  if (property.type === 'checkbox') return Boolean(property.checkbox);
  const text = propertyString(property).trim().toLowerCase();
  if (['true', 'yes', '1', '是', '完成', '启用'].includes(text)) return true;
  if (['false', 'no', '0', '否', '未完成', '停用'].includes(text)) return false;
  return undefined;
};

export const firstProperty = (
  properties: Record<string, NotionProperty>,
  names: string[],
): NotionProperty | undefined => {
  for (const name of names) {
    if (properties[name]) return properties[name];
  }
  return undefined;
};

export const firstString = (properties: Record<string, NotionProperty>, names: string[]) =>
  propertyString(firstProperty(properties, names)).trim();

export const firstNumber = (properties: Record<string, NotionProperty>, names: string[]) =>
  propertyNumber(firstProperty(properties, names));

export const firstBoolean = (properties: Record<string, NotionProperty>, names: string[]) =>
  propertyBoolean(firstProperty(properties, names));

export const findSchemaProperty = (
  schema: NotionDataSource['properties'],
  names: string[],
): [string, { id?: string; type?: string }] | undefined => {
  for (const name of names) {
    if (schema[name]) return [name, schema[name]];
  }
  return undefined;
};

export const createPage = (
  dataSourceId: string,
  token: string,
  properties: Record<string, unknown>,
) => notionRequest<NotionPage>('/pages', token, {
  method: 'POST',
  body: JSON.stringify({ parent: { data_source_id: dataSourceId }, properties }),
});
