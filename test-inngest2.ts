import { Inngest } from "inngest";
const inngest = new Inngest({ id: "test" });
inngest.createFunction(
  { id: "my-fn", event: "my.event" },
  async () => {}
);
