import type { Metadata } from "next";

import { RunDetail } from "@/components/run-detail";

export const metadata: Metadata = {
  title: "Local test run | Trial by User",
  description: "Review a browser-local FlowPilot test configuration.",
};

type RunPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  return <RunDetail runId={id} />;
}
