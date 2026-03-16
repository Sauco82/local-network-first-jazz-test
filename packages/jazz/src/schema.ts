import { co, z } from "jazz-tools";

export const TodoItem = co.map({
  title: z.string(),
  done: z.boolean(),
  createdAt: z.number(),
});

export const TodoCollection = co.list(TodoItem);

export const LocalNotesRoot = co.map({
  todos: TodoCollection,
});

export const LocalNotesAccount = co
  .account({
    root: LocalNotesRoot,
    profile: co.profile(),
  })
  .withMigration((account) => {
    if (!account.$jazz.has("root")) {
      account.$jazz.set("root", {
        todos: [],
      });
    }
  });
