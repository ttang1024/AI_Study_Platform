// Service logic moved to the shared package (packages/core) — rn/'s shareService
// posted the identical payload (including the JSON-stringified collections) and
// read the identical SharedContent. This file wires the web HTTP adapter into
// the shared factory and adds the one web-local part: the public share URL,
// built from web's own share base URL.
import { createShareService, type CreateSharePayload } from '@core/services/shareService';
import { http } from './http';
import { getShareBaseUrl } from '../utils/env';

export * from '@core/services/shareService';

const core = createShareService(http);

export interface ShareResult {
  token: string;
  shareUrl: string;
}

export async function createShare(payload: CreateSharePayload): Promise<ShareResult> {
  const { token } = await core.createShare(payload);
  return { token, shareUrl: `${getShareBaseUrl()}/share/${token}` };
}

export const getShare = core.getShare;
