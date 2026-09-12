import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { api } from "@/shared/api/commands";
import { toAppError } from "@/shared/api/errors";
import { useProjects } from "@/shared/api/queries";
import { invalidateProjectData } from "@/shared/api/query-keys";
import type { Id, ProjectSummary } from "@/shared/api/types";
import { PROJECT_COLORS } from "@/shared/lib/colors";
import { useUiStore } from "@/shared/stores/ui";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { toast } from "@/shared/ui/sonner";

/**
 * Form Dự án (Tên*, Mã*, Màu). Mở bằng `useUiStore.getState().openProjectDialog(projectId | null)`;
 * layout luôn render component này.
 */
export function ProjectDialog() {
  const state = useUiStore((s) => s.projectDialog);
  const close = useUiStore((s) => s.closeProjectDialog);
  const projects = useProjects().data;
  // Giữ dự án đang hiện trong lúc hộp đóng dần (store đã về { open: false }).
  const [shownId, setShownId] = useState<Id | null>(null);
  if (state.open && state.projectId !== shownId) setShownId(state.projectId);
  const project = shownId === null ? null : (projects?.find((p) => p.id === shownId) ?? null);
  const nextColor = PROJECT_COLORS[(projects?.length ?? 0) % PROJECT_COLORS.length];

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-[460px]">
        {(shownId === null || project) && (
          <ProjectForm
            key={shownId ?? "new"}
            project={project}
            defaultColor={nextColor}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Field = "name" | "code" | "color";
const FIELDS: readonly string[] = ["name", "code", "color"];
const ERR = "text-xs font-bold text-danger";
const HINT = "text-[12.5px] font-semibold text-muted";

function ProjectForm({
  project,
  defaultColor,
  onDone,
}: {
  project: ProjectSummary | null;
  defaultColor: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const id = useId();
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [color, setColor] = useState(project?.color ?? defaultColor);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const codeLocked = project?.hasTasks ?? false;

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), code: code.trim().toUpperCase(), color };
      return project ? api.updateProject({ id: project.id, ...input }) : api.createProject(input);
    },
    // Lỗi có `field` (VALIDATION, DUPLICATE_CODE) hiện dưới trường; lỗi khác hiện toast.
    meta: { silentError: true },
    onSuccess: (p) => {
      invalidateProjectData(qc);
      onDone();
      if (project) {
        toast.success(`Đã lưu dự án ${p.code} · ${p.name}`);
      } else {
        toast.success(`Đã tạo dự án ${p.name} (${p.code})`);
        navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
      }
    },
    onError: (e) => {
      const err = toAppError(e);
      if (err.field && FIELDS.includes(err.field)) setErrors({ [err.field]: err.message });
      else toast.error(err.message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <DialogHeader>
        <DialogTitle>{project ? `Sửa dự án ${project.code}` : "Dự án mới"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-label">
          TÊN DỰ ÁN *
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Website công ty"
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && <span className={ERR}>{errors.name}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-code`} className="text-label">
          MÃ DỰ ÁN *
        </label>
        <Input
          id={`${id}-code`}
          className="w-40"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ví dụ: WEB"
          disabled={codeLocked}
          title={codeLocked ? "Không đổi được mã vì dự án đã có việc." : undefined}
          aria-invalid={errors.code ? true : undefined}
        />
        {errors.code ? (
          <span className={ERR}>{errors.code}</span>
        ) : (
          <span className={HINT}>
            {codeLocked
              ? "Không đổi được mã vì dự án đã có việc."
              : "2–6 chữ in hoa hoặc số, bắt đầu bằng chữ, không trùng dự án khác"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label">MÀU</span>
        <div className="flex gap-2.5 p-1">
          {PROJECT_COLORS.map((c) => {
            const on = c.toUpperCase() === color.toUpperCase();
            return (
              <button
                key={c}
                type="button"
                aria-label={`Màu ${c}`}
                aria-pressed={on}
                onClick={() => setColor(c)}
                className="size-7 flex-none rounded-full"
                style={{
                  background: c,
                  boxShadow: on ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : undefined,
                }}
              />
            );
          })}
        </div>
        {errors.color && <span className={ERR}>{errors.color}</span>}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {project ? "Lưu thay đổi" : "Tạo dự án"}
        </Button>
      </DialogFooter>
    </form>
  );
}
