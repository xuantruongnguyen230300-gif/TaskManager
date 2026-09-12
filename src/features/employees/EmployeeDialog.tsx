import { Check } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toAppError } from "@/shared/api/errors";
import type { EmployeeRow } from "@/shared/api/types";
import { AVATAR_COLORS, DEFAULT_AVATAR_COLOR } from "@/shared/lib/colors";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { toast } from "@/shared/ui/sonner";
import { useSaveEmployee } from "./use-employees";

export type EditableEmployee = Pick<
  EmployeeRow,
  "id" | "fullName" | "title" | "phone" | "email" | "color"
>;

/** Form nhân viên (SC-6): Họ tên*, Chức danh, Điện thoại, Email, Màu đại diện. `employee` null = thêm. */
export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  defaultColor = DEFAULT_AVATAR_COLOR,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EditableEmployee | null;
  defaultColor?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        {/* Nội dung chỉ mount khi mở → mỗi lần mở là form mới. */}
        <EmployeeForm
          employee={employee}
          defaultColor={defaultColor}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type Field = "fullName" | "title" | "phone" | "email" | "color";
const FIELDS: readonly string[] = ["fullName", "title", "phone", "email", "color"];

function TextField({
  id,
  label,
  required = false,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error && <span className="text-xs font-bold text-danger">{error}</span>}
    </div>
  );
}

function EmployeeForm({
  employee,
  defaultColor,
  onDone,
}: {
  employee: EditableEmployee | null;
  defaultColor: string;
  onDone: () => void;
}) {
  const id = useId();
  const [form, setForm] = useState({
    fullName: employee?.fullName ?? "",
    title: employee?.title ?? "",
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    color: employee?.color ?? defaultColor,
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const save = useSaveEmployee();
  const set = (k: Field) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const name = form.fullName.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name) {
      setErrors({ fullName: "Vui lòng nhập họ tên." });
      return;
    }
    setErrors({});
    const input = {
      fullName: name,
      title: form.title.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      color: form.color,
    };
    save.mutate(employee ? { id: employee.id, ...input } : input, {
      onSuccess: (d) => {
        toast.success(
          employee ? `Đã lưu thay đổi cho ${d.fullName}` : `Đã thêm nhân viên ${d.fullName}`,
        );
        onDone();
      },
      // VALIDATION → dưới trường; lỗi khác đã có toast chung.
      onError: (err) => {
        const ae = toAppError(err);
        if (ae.code === "VALIDATION" && ae.field && FIELDS.includes(ae.field)) {
          setErrors({ [ae.field]: ae.message });
        }
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader className="flex-row items-baseline gap-2.5">
        <DialogTitle className="text-lg">
          {employee ? "Sửa thông tin nhân viên" : "Thêm nhân viên"}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] font-semibold text-muted">
          {employee ? employee.fullName : "Người được giao việc, không dùng app"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
        <TextField
          id={`${id}-name`}
          label="Họ tên"
          required
          value={form.fullName}
          onChange={set("fullName")}
          placeholder="Ví dụ: Nguyễn Văn An"
          error={errors.fullName}
        />
        <TextField
          id={`${id}-title`}
          label="Chức danh"
          value={form.title}
          onChange={set("title")}
          placeholder="Ví dụ: Lập trình viên"
          error={errors.title}
        />
        <TextField
          id={`${id}-phone`}
          label="Điện thoại"
          value={form.phone}
          onChange={set("phone")}
          placeholder="Ví dụ: 0901 000 008"
          error={errors.phone}
        />
        <TextField
          id={`${id}-email`}
          label="Email"
          value={form.email}
          onChange={set("email")}
          placeholder="ten@congty.vn"
          error={errors.email}
        />
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-label">Màu đại diện</span>
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap gap-[9px] p-1">
              {AVATAR_COLORS.map((c, i) => {
                const on = c.toUpperCase() === form.color.toUpperCase();
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Màu ${i + 1}`}
                    aria-pressed={on}
                    title={`Màu ${i + 1}`}
                    onClick={() => set("color")(c)}
                    className="size-7 flex-none rounded-full"
                    style={{
                      background: c,
                      boxShadow: on ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-2.5 rounded-[28px] bg-surface2 py-2 pr-4 pl-2">
              <Avatar name={name || null} color={form.color} size="lg" />
              <div className="flex min-w-0 flex-col">
                <span className="max-w-[150px] truncate text-sm font-extrabold">
                  {name || "Họ tên nhân viên"}
                </span>
                <span className="text-[12.5px] font-semibold text-muted">Xem trước</span>
              </div>
            </div>
          </div>
          {errors.color && <span className="text-xs font-bold text-danger">{errors.color}</span>}
        </div>
      </div>

      <DialogFooter className="items-center">
        <span className="mr-auto text-[12.5px] font-semibold text-muted">
          Trường có dấu * là bắt buộc.
        </span>
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={save.isPending}>
          <Check className="size-[15px]" strokeWidth={3} />
          {employee ? "Lưu thay đổi" : "Thêm nhân viên"}
        </Button>
      </DialogFooter>
    </form>
  );
}
