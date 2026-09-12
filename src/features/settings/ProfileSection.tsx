import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { api } from "@/shared/api/commands";
import { errorMessage, isAppError } from "@/shared/api/errors";
import { useSettings } from "@/shared/api/queries";
import { invalidateEmployeeData, queryKeys } from "@/shared/api/query-keys";
import type { EmployeeDetail } from "@/shared/api/types";
import { AVATAR_COLORS } from "@/shared/lib/colors";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { toast } from "@/shared/ui/sonner";
import { SROW } from "./styles";

interface Draft {
  fullName: string;
  title: string;
  phone: string;
  email: string;
  color: string;
}

type FieldKey = "fullName" | "title" | "phone" | "email";

function toDraft(e: EmployeeDetail): Draft {
  return {
    fullName: e.fullName,
    title: e.title ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    color: e.color.toUpperCase(),
  };
}

/** Kiểm tra theo 02 §6 (form Nhân viên). */
function validate(d: Draft): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const name = d.fullName.trim();
  if (!name) errors.fullName = "Vui lòng nhập họ tên.";
  else if (name.length > 100) errors.fullName = "Họ tên tối đa 100 ký tự.";
  if (d.title.trim().length > 100) errors.title = "Chức danh tối đa 100 ký tự.";
  if (d.phone.trim().length > 20) errors.phone = "Điện thoại tối đa 20 ký tự.";
  if (d.email.trim().length > 254) errors.email = "Email tối đa 254 ký tự.";
  return errors;
}

/** Hồ sơ "Tôi" (bản ghi nhân viên isSelf) — sửa qua update_employee. */
export function ProfileSection() {
  const settings = useSettings();
  const selfId = settings.data?.selfEmployeeId;
  const employee = useQuery({
    queryKey: queryKeys.employee(selfId ?? 0),
    queryFn: () => api.getEmployee(selfId ?? 0),
    enabled: selfId != null,
  });

  const error = settings.error ?? employee.error;
  if (error) return <div className="text-sub">{errorMessage(error)}</div>;
  if (!employee.data) return <div className="text-sub">Đang tải…</div>;
  const e = employee.data;
  return <ProfileForm key={`${e.id}:${e.updatedAt}`} employee={e} />;
}

function ProfileForm({ employee }: { employee: EmployeeDetail }) {
  const qc = useQueryClient();
  const [initial] = useState(() => toDraft(employee));
  const [draft, setDraft] = useState(initial);
  const [serverError, setServerError] = useState<{ field: string; message: string } | null>(null);

  const errors = validate(draft);
  const hasError = Object.keys(errors).length > 0;
  const dirty = (Object.keys(initial) as (keyof Draft)[]).some((k) => initial[k] !== draft[k]);

  const save = useMutation({
    mutationFn: api.updateEmployee,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.employee(data.id), data);
      toast.success("Đã lưu hồ sơ của tôi");
      return invalidateEmployeeData(qc);
    },
    onError: (err) => {
      if (isAppError(err, "VALIDATION") && err.field) {
        setServerError({ field: err.field, message: err.message });
      }
    },
  });

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerError(null);
  };

  const fieldError = (k: FieldKey) =>
    errors[k] ?? (serverError?.field === k ? serverError.message : undefined);

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (hasError || !dirty || save.isPending) return;
    save.mutate({
      id: employee.id,
      fullName: draft.fullName.trim(),
      title: draft.title.trim() || null,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      color: draft.color,
    });
  };

  const name = draft.fullName.trim();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className={SROW}>
        <Avatar name={name || null} color={draft.color} className="size-[52px] text-[18px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center gap-2">
            <span className="truncate font-extrabold text-[17px]">{name || "Chưa có họ tên"}</span>
            <span className="inline-flex h-[22px] items-center rounded-chip bg-hero px-[9px] font-extrabold text-hero-ink text-xs">
              Tôi
            </span>
          </div>
          <span className="text-[12.5px] text-muted">
            {draft.title.trim() || "Chưa có chức danh"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-nav bg-hero px-3.5 py-2.5 font-bold text-[13.5px] text-hero-ink">
        <Info className="flex-none" />
        <span>
          Hồ sơ này hiển thị là “Tôi” và là người tạo mặc định. Không xoá và không chuyển “Đã nghỉ”
          được.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Field id="pf-name" label="Họ tên *" error={fieldError("fullName")}>
          <Input
            id="pf-name"
            value={draft.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            placeholder="Ví dụ: Trần Minh Quân"
            aria-invalid={!!fieldError("fullName")}
          />
        </Field>
        <Field id="pf-title" label="Chức danh" error={fieldError("title")}>
          <Input
            id="pf-title"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Ví dụ: Trưởng nhóm"
            aria-invalid={!!fieldError("title")}
          />
        </Field>
        <Field id="pf-phone" label="Điện thoại" error={fieldError("phone")}>
          <Input
            id="pf-phone"
            value={draft.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="Ví dụ: 0901 000 001"
            aria-invalid={!!fieldError("phone")}
          />
        </Field>
        <Field id="pf-email" label="Email" error={fieldError("email")}>
          <Input
            id="pf-email"
            type="email"
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="ten@congty.vn"
            aria-invalid={!!fieldError("email")}
          />
        </Field>
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-label">Màu đại diện</span>
          <div className="flex flex-wrap gap-3 px-0.5 py-1">
            {AVATAR_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                title={`Màu ${i + 1}`}
                aria-label={`Màu ${i + 1}`}
                aria-pressed={draft.color === c}
                onClick={() => set({ color: c })}
                className={cn(
                  "size-7 flex-none rounded-full",
                  draft.color === c && "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        {dirty && (
          <span className="whitespace-nowrap text-[12.5px] text-warn">Có thay đổi chưa lưu</span>
        )}
        <div className="ml-auto flex gap-2">
          {dirty && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft(initial);
                setServerError(null);
              }}
            >
              Huỷ thay đổi
            </Button>
          )}
          <Button
            type="submit"
            disabled={hasError || !dirty || save.isPending}
            title={
              errors.fullName
                ? "Nhập họ tên trước khi lưu"
                : dirty
                  ? "Lưu hồ sơ"
                  : "Chưa có thay đổi"
            }
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {children}
      {error && <span className="font-bold text-danger text-xs">{error}</span>}
    </div>
  );
}
