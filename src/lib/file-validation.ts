/**
 * Shared file validation utilities for attachment handling.
 */

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_ATTACHMENTS = 5;

/**
 * Validate and add files to an attachment list.
 * Returns the new attachment list and any error message.
 */
export function validateAndAddFiles(
  files: File[],
  existing: File[],
): { attachments: File[]; error: string | null } {
  const validFiles: File[] = [];
  const rejected: string[] = [];

  files.forEach((file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejected.push(file.name);
    } else {
      validFiles.push(file);
    }
  });

  let error: string | null = null;
  if (rejected.length > 0) {
    error = `${rejected.join(", ")} exceeded 20MB limit`;
  }

  const combined = [...existing, ...validFiles];
  if (combined.length > MAX_ATTACHMENTS) {
    error = "Maximum of 5 attachments";
    return { attachments: combined.slice(0, MAX_ATTACHMENTS), error };
  }

  return { attachments: combined, error };
}
