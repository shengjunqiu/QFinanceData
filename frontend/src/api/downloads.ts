import { ApiError, buildApiUrl, type QueryParams } from "./client";

export async function downloadCsv(path: string, filename: string, query?: QueryParams): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, query));
  } catch (error) {
    throw new ApiError(getUnknownErrorMessage(error), {
      status: 0,
      details: error
    });
  }

  if (!response.ok) {
    throw new ApiError(await readDownloadError(response), {
      status: response.status,
      details: await readDownloadDetails(response)
    });
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = readContentDispositionFilename(response) ?? filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function readContentDispositionFilename(response: Response): string | null {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

async function readDownloadError(response: Response): Promise<string> {
  const details = await readDownloadDetails(response);
  if (typeof details === "string" && details) {
    return details;
  }
  if (details && typeof details === "object" && "detail" in details) {
    const detail = details.detail;
    if (typeof detail === "string" && detail) {
      return detail;
    }
  }
  return `Download failed with status ${response.status}.`;
}

async function readDownloadDetails(response: Response): Promise<unknown> {
  const clone = response.clone();
  const contentType = clone.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return await clone.json();
    }
    return await clone.text();
  } catch {
    return null;
  }
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Network request failed.";
}
