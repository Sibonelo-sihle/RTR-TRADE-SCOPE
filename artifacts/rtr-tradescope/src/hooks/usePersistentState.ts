import { useState } from "react";

export function usePersistentState<T>(load: () => T, save: (value: T) => T) {
  const [value, setValueState] = useState<T>(load);
  const setValue = (next: T | ((previous: T) => T)) =>
    setValueState((previous) => {
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      save(resolved);
      return resolved;
    });
  return [value, setValue] as const;
}
