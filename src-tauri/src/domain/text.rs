//! Chuẩn hoá chữ: bỏ dấu tiếng Việt cho tìm kiếm (R-11), trim chuỗi tuỳ chọn.

use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

/// Bỏ dấu, `đ`/`Đ` → `d`, chữ thường. Ví dụ "Hoá đơn" → "hoa don".
pub fn fold_vi(s: &str) -> String {
    s.nfd()
        .filter(|c| !is_combining_mark(*c))
        .map(|c| match c {
            'đ' | 'Đ' => 'd',
            other => other,
        })
        .flat_map(char::to_lowercase)
        .collect()
}

/// `haystack` có chứa `needle` không, bỏ qua dấu và hoa thường. `needle` rỗng → true.
pub fn contains_folded(haystack: &str, needle: &str) -> bool {
    let needle = fold_vi(needle.trim());
    needle.is_empty() || fold_vi(haystack).contains(&needle)
}

/// Trim; chuỗi rỗng → None.
pub fn trim_opt(s: Option<&str>) -> Option<String> {
    s.map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r11_fold_vi_removes_marks_and_d() {
        assert_eq!(fold_vi("Hoá đơn"), "hoa don");
        assert_eq!(fold_vi("ĐĂNG NHẬP"), "dang nhap");
        assert_eq!(fold_vi("WEB-12 Tối ưu"), "web-12 toi uu");
    }

    #[test]
    fn r11_contains_folded_matches_without_marks() {
        assert!(contains_folded("Đăng nhập bằng Google", "dang nhap"));
        assert!(contains_folded("WEB-12", "web-1"));
        assert!(contains_folded("bất kỳ", "  "));
        assert!(!contains_folded("Báo giá", "hoa don"));
    }

    #[test]
    fn trim_opt_empty_is_none() {
        assert_eq!(trim_opt(Some("  ")), None);
        assert_eq!(trim_opt(Some(" a ")), Some("a".to_string()));
        assert_eq!(trim_opt(None), None);
    }
}
