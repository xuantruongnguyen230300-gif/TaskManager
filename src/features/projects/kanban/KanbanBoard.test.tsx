import type { DragEndEvent } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/shared/api/commands";
import type { TaskDetail, TaskRow } from "@/shared/api/types";
import { KanbanBoard } from "./KanbanBoard";

/** Giữ DndContext thật, chỉ bắt `onDragEnd` để giả lập thả thẻ vào một cột. */
let dragEnd: ((e: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@dnd-kit/core")>();
  const { createElement } = await import("react");
  return {
    ...mod,
    DndContext: (props: ComponentProps<typeof mod.DndContext>) => {
      dragEnd = props.onDragEnd;
      return createElement(mod.DndContext, props);
    },
  };
});

// vitest không bật `globals` → Testing Library không tự dọn DOM giữa các ca.
afterEach(cleanup);

const row: TaskRow = {
  id: 7,
  code: "WEB-7",
  title: "Dựng trang chủ",
  projectId: 2,
  projectCode: "WEB",
  projectName: "Website",
  projectColor: "#5B8DEF",
  assigneeId: null,
  assigneeName: null,
  assigneeColor: null,
  assigneeInactive: false,
  creatorId: 1,
  creatorName: "Tôi",
  status: "new",
  priority: 2,
  startDate: null,
  dueDate: null,
  createdAt: 0,
  subtaskDone: 0,
  subtaskTotal: 0,
  commentCount: 0,
  attachmentCount: 0,
};

function setup() {
  const spy = vi.spyOn(api, "setTaskStatus").mockResolvedValue({} as TaskDetail);
  vi.spyOn(api, "listTasks").mockResolvedValue([row]);
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <KanbanBoard
        projectId={2}
        filter={{ projectId: 2 }}
        rows={[row]}
        filtered={false}
        onOpenTask={() => {}}
      />
    </QueryClientProvider>,
  );
  const drop = (over: string) =>
    act(() => dragEnd?.({ active: { id: row.id }, over: { id: over } } as unknown as DragEndEvent));
  return { spy, drop };
}

describe("Kanban: kéo thẻ sang cột = set_task_status", () => {
  it("thả vào Hoàn thành gọi setTaskStatus với trạng thái done", async () => {
    const { spy, drop } = setup();
    drop("done");
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ id: 7, status: "done", note: null }));
  });

  it("thả vào Đang chờ hỏi lý do rồi mới gọi, kèm lý do", async () => {
    const { spy, drop } = setup();
    drop("waiting");
    expect(spy).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Lý do chờ" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Chờ khách" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ id: 7, status: "waiting", note: "Chờ khách" }),
    );
  });

  it("thả vào Đã huỷ rồi bấm Huỷ thì không đổi trạng thái", () => {
    const { spy, drop } = setup();
    drop("cancelled");
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(spy).not.toHaveBeenCalled();
  });

  it("thả vào chính cột cũ thì không gọi", () => {
    const { spy, drop } = setup();
    drop("new");
    expect(spy).not.toHaveBeenCalled();
  });
});
