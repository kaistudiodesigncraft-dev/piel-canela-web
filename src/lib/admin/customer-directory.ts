export const CUSTOMER_DIRECTORY_PAGE_SIZE = 30;

export interface CustomerDirectoryQuery {
  query: string;
  page: number;
}

function cleanQuery(value: string | undefined) {
  return (value ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[,()%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCustomerDirectoryQuery(
  input: Record<string, string | undefined>,
): CustomerDirectoryQuery {
  const page = Number.parseInt(input.customerPage ?? "1", 10);
  return {
    query: cleanQuery(input.customerQuery),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function customerDirectoryPageRange(
  page: number,
  pageSize = CUSTOMER_DIRECTORY_PAGE_SIZE,
) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function customerDirectoryHref(
  current: CustomerDirectoryQuery,
  changes: Partial<CustomerDirectoryQuery>,
) {
  const next = { ...current, ...changes };
  const params = new URLSearchParams({
    customerQuery: next.query,
    customerPage: String(next.page),
  });
  return `/admin/clientes?${params.toString()}#directorio`;
}
