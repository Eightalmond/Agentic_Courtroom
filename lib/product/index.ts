export { flowPilotProduct } from "./data";
export type {
  ProductCallout,
  ProductCategory,
  ProductDefinition,
  ProductMetadata,
  ProductPage,
  ProductSection,
} from "./types";

import { flowPilotProduct } from "./data";

export function getProductPage(slug: string) {
  return flowPilotProduct.pages.find((page) => page.slug === slug);
}
