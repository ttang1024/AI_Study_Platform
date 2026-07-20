// Accepted document upload formats — single-sourced in @core/documentUpload
// (kept in sync with the backend allowlist in DocumentsController.Crud.cs).
// The web `accept` attribute string and `File`-typed helper live in web's shim;
// `expo-document-picker` takes MIME types directly.
export * from '@core/documentUpload';
