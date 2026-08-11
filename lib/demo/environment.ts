import "server-only";

import { parseDemoConfiguration, type DemoEnvironment } from "./config";

export function readDemoConfiguration(environment: DemoEnvironment = process.env) {
  return parseDemoConfiguration(environment);
}
