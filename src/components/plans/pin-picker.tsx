"use client";
import { linkTaskToPinAction } from "@/app/actions/plans";
import { OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { t } from "@/lib/i18n";

/** PM links a task to a pin on one of the project's plans. */
export function PinPicker({ taskId, value, pins }: { taskId: string; value: string | null; pins: Option[] }) {
  const { call, pending } = useAction();
  if (!pins.length) return null;
  return (
    <OptionSelect
      className="h-9 w-full sm:w-72"
      value={value}
      onChange={(v) => !pending && call(() => linkTaskToPinAction(taskId, v), t.app.saved)}
      options={pins}
      noneLabel={t.tasks.noPin}
    />
  );
}
