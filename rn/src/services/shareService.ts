// Service logic moved to the shared package (packages/core) — web/'s
// shareContentService posted the identical payload (including the
// JSON-stringified collections) and read the identical SharedContent. This shim
// wires the RN HTTP adapter into the shared factory and binds the two URL
// builders to rn's env constants.
import {
  createShareService,
  shareMediaUrl as buildShareMediaUrl,
  type CreateSharePayload,
  type ShareMediaKind,
} from '@core/services/shareService';
import { API_URL, SHARE_BASE_URL } from '@/constants/env';
import { http } from '@/services/http';

// Named re-exports rather than `export *`: `shareMediaUrl` below is bound to rn's
// API_URL, and a star re-export of the same name collides with it.
export { extractShareToken } from '@core/services/shareService';
export type {
  CreateSharePayload,
  ShareMediaKind,
  ShareSourceType,
  ShareableCard,
  ShareableGlossaryTerm,
  ShareableQuiz,
  SharedContent,
} from '@core/services/shareService';

const core = createShareService(http);

export interface ShareResult {
  token: string;
  shareUrl: string;
}

export async function createShare(payload: CreateSharePayload): Promise<ShareResult> {
  const { token } = await core.createShare(payload);
  return { token, shareUrl: `${SHARE_BASE_URL}/share/${token}` };
}

export const getShare = core.getShare;

/** Anonymous media stream URLs for a share (audio, uploaded video, article text). */
export const shareMediaUrl = (token: string, kind: ShareMediaKind): string =>
  buildShareMediaUrl(API_URL, token, kind);

export const fetchDocumentShareCards = core.getDocumentShareCards;

export const fetchVideoShareCards = core.getVideoShareCards;
