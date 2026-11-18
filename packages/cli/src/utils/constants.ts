export const MAX_SUGGESTIONS_COUNT = 30;
export const MAX_KEY_HOLD_DURATION_MS = 2000;
export const MAX_CONTEXT_LINES = 50;

export const DEFAULT_WATCH_DIR = ".react-grab";
export const DARWIN_READER_BINARY_NAME = "pbread";
export const DEFAULT_WATCH_INTERVAL_MS = 800;
export const READ_WAIT_POLL_MS = 200;
export const DAEMON_CLAIM_MAX_ATTEMPTS = 50;
export const READ_DEFAULT_LIMIT = 50;
export const DEFAULT_GRAB_AGE_MS = 5 * 60 * 1000;
// A single read must never build a >512 MB string (V8's cap); a bigger backlog
// drains across calls. Must exceed the largest single grab line.
export const MAX_READ_HISTORY_BYTES = 128 * 1024 * 1024;

// Buffer size for the legacy-cursor migration's chunked newline scan, which
// counts newline bytes without materializing the whole history as a string.
export const MIGRATION_SCAN_CHUNK_BYTES = 1024 * 1024;

export const LINUX_WEB_FORMAT_MAP = 'application/web;type="custom/formatmap"';
export const LINUX_WEB_FORMAT_ENTRY = /^application\/web;type="custom\/format(?:0|[1-9]\d?)"$/;
