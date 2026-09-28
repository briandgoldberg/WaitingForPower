import { redirect } from "next/navigation";

// The Board index folded into the Community hub's "board" tab (the
// default tab at /activity) — individual topic threads keep their own
// /board/[id] URL (see that route), only this index moved.
export default function BoardIndexRedirect() {
  redirect("/activity");
}
