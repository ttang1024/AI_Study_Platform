/** The server's paged-list envelope, with its items mapped to client shapes. */
export interface Paged<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const mapPaged = <TIn, TOut>(page: Paged<TIn>, map: (item: TIn) => TOut): Paged<TOut> => ({
  items: page.items.map(map),
  totalCount: page.totalCount,
  page: page.page,
  pageSize: page.pageSize,
  totalPages: page.totalPages,
});
