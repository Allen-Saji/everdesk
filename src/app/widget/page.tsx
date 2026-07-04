import { Suspense } from "react";
import Chat from "@/components/widget/Chat";

export const metadata = { title: "Support chat" };

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!key) {
    return (
      <p className="p-6 text-sm text-slate-500">
        Missing widget key. Embed this page via the EverDesk script tag.
      </p>
    );
  }
  return (
    <Suspense>
      <Chat companyKey={key} />
    </Suspense>
  );
}
