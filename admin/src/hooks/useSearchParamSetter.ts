import { useCallback } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

/**
 * Writes one query parameter, dropping it when the value is empty.
 *
 * <p>Changing any filter resets `page`, because page 4 of the previous filter is almost never a
 * page of the new one — every paged admin list needs that, so it lives here.</p>
 */
export function useSearchParamSetter(setSearchParams: SetURLSearchParams) {
  return useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }, [setSearchParams]);
}
