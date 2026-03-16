import { useAccount } from "jazz-tools/react";
import { LocalNotesAccount } from "./schema";

export function useTodoAccount() {
  return useAccount(LocalNotesAccount, {
    resolve: {
      root: {
        todos: {
          $each: true,
        },
      },
    },
  });
}
