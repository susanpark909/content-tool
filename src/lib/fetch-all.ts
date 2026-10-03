// The database returns at most 1,000 rows per request. This keeps asking for
// the next 1,000 until everything has come back, so lists never get cut off.
const PAGE_SIZE = 1000;

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}
