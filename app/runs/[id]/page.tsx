import type { Metadata } from "next";

import { RunDetail } from "@/components/run-detail";
import { readDemoConfiguration } from "@/lib/demo/environment";

export const metadata: Metadata = {
  title: "Local test run | Trial by User",
  description: "Run and review a browser-local FlowPilot synthetic customer simulation.",
};

type RunPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  return <RunDetail demoMode={readDemoConfiguration().demoMode} runId={id} />;
}
