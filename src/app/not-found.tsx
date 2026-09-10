import { ButtonLink } from "@/components/ui/button";
import { MessagePage } from "@/components/ui/message-page";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <MessagePage
      title="That page does not exist"
      action={<ButtonLink href="/">Back to the start</ButtonLink>}
    >
      <p>The link may be out of date, or it may never have been a page here.</p>
    </MessagePage>
  );
}
