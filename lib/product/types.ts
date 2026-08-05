export type ProductCategory =
  | "Product"
  | "Plans & billing"
  | "Developers"
  | "Workspace administration"
  | "Data & security";

export type ProductCallout = {
  type: "info" | "warning";
  title: string;
  content: string;
};

export type ProductSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type ProductPage = {
  slug: string;
  title: string;
  summary: string;
  category: ProductCategory;
  sections: readonly ProductSection[];
  relatedSlugs: readonly string[];
  keywords: readonly string[];
  callouts?: readonly ProductCallout[];
};

export type ProductMetadata = {
  id: string;
  name: string;
  description: string;
  disclaimer: string;
};

export type ProductDefinition = ProductMetadata & {
  pages: readonly ProductPage[];
};
