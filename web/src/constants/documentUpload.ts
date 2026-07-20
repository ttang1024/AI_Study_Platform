// Accepted document upload formats — single-sourced in @core/documentUpload
// (kept in sync with the backend allowlist in DocumentsController.Crud.cs).
// This shim adds the web-only `accept` attribute string and `File`-typed helper.
import { DOCUMENT_ACCEPTED_EXTENSIONS, isAcceptedDocumentFile as isAcceptedDocumentName } from '@core/documentUpload'
export { DOCUMENT_ACCEPTED_EXTENSIONS, DOCUMENT_ACCEPTED_MIME_TYPES } from '@core/documentUpload'

export const DOCUMENT_ACCEPT_ATTR = DOCUMENT_ACCEPTED_EXTENSIONS.join(',')

export function isAcceptedDocumentFile(f: File): boolean {
	return isAcceptedDocumentName(f.name, f.type)
}
