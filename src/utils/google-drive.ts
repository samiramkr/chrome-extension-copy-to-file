import type { RecentDoc, DriveFilesResponse } from "@/types";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

/**
 * Fetch the last N Google Docs from Drive API.
 */
export async function fetchRecentDriveDocs(
  token: string,
  pageSize = 5
): Promise<RecentDoc[]> {
  const response = await fetch(
    `${DRIVE_API}?` +
      new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.document' and trashed=false",
        orderBy: "modifiedByMeTime desc",
        pageSize: String(pageSize),
        fields: "files(id,name)",
      }),
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) throw new Error("Failed to fetch docs");

  const data: DriveFilesResponse = await response.json();
  return (data.files || []).map((f) => ({ docId: f.id, title: f.name }));
}
