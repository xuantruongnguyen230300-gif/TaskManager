/** Bỏ dấu tiếng Việt, đ→d, chữ thường (giống `fold_vi` ở Rust, R-11). "Hoá đơn" → "hoa don". */
export function foldVi(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** `haystack` chứa `needle` (bỏ dấu, không phân biệt hoa thường). `needle` rỗng → true. */
export function includesFolded(haystack: string, needle: string): boolean {
  const n = foldVi(needle.trim());
  return n === "" || foldVi(haystack).includes(n);
}
