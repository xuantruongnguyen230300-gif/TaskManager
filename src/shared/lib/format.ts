/** Dung lượng tệp kiểu Việt: "380 KB", "2,4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

/** Chữ tắt avatar: hai chữ đầu của hai từ cuối. "Trần Minh Quân" → "MQ", "Tôi" → "T". */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const pick = words.length >= 2 ? words.slice(-2) : words;
  return pick
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

/** Tiến độ dự án "x/y (z%)"; y = 0 → "—". */
export function progressLabel(done: number, total: number): string {
  if (total <= 0) return "—";
  return `${done}/${total} (${Math.round((done / total) * 100)}%)`;
}
