/** Search params của SC-3 Dự án. Không có `view` = Kanban. F3 được mở rộng (khoá phải tuỳ chọn). */
export interface ProjectSearch {
  view?: "kanban" | "list";
}

export function validateProjectSearch(search: Record<string, unknown>): ProjectSearch {
  return search.view === "list" ? { view: "list" } : {};
}
