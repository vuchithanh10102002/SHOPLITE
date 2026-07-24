import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const FIELD_CLASS =
  "w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 " +
  "focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Loi cua RIENG field nay (tu zodResolver) — hien ngay duoi input. */
  error?: string;
}

/**
 * forwardRef bat buoc: react-hook-form `register()` tra ve mot `ref`, khong nhan
 * duoc ref thi field khong bao gio duoc dang ky → form luon rong.
 *
 * (React 19 cho phep nhan `ref` nhu prop thuong, nhung giu forwardRef de khong
 * phu thuoc phien ban khi ai do doc lai code nay tren du an cu.)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...rest },
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

      <input
        ref={ref}
        id={fieldId}
        // a11y: screen reader doc duoc loi, khong chi nhin thay mau do.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(FIELD_CLASS, error ? "border-red-500" : "border-gray-300", className)}
        {...rest}
      />

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, ...rest },
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

      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(FIELD_CLASS, error ? "border-red-500" : "border-gray-300", className)}
        {...rest}
      />

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
