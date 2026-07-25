import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Class dung cho cac <select> loc o thanh cong cu (khong nhan, khong loi) —
 * cung chuoi ma ProductsPage dat inline tu Phase 5, gio co MOT cho.
 */
export const SELECT_CLASS =
  "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm " +
  "focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/**
 * <select> cho FORM: co nhan + cho hien loi, bam khuon Input/Textarea.
 * forwardRef bat buoc — react-hook-form `register()` gan ref, khong nhan duoc
 * thi field khong bao gio duoc dang ky.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;

  return (
    <div>
      {label && (
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary",
          error ? "border-red-500" : "border-gray-300",
          className,
        )}
        {...rest}
      >
        {children}
      </select>

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
