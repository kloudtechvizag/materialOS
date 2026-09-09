export interface FaqEntry {
  q: string;
  a: string;
}

export interface IndustryContent {
  /** Must match a real slug in app/services/industry.py's PROFILE_DEFINITIONS. */
  slug: string;
  name: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  heroTagline: string;
  problems: string[];
  solution: string;
  /** Hand-cross-checked against that slug's real enabled_modules/inventory_flags
   * in apps/api/app/services/industry.py -- must stay consistent with it. */
  capabilities: string[];
  workflow: string[];
  useCases: string[];
  faqs: FaqEntry[];
  relatedIndustrySlugs: string[];
  relatedFeatureSlugs: string[];
}

export interface FeatureContent {
  slug: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  problem: string;
  solutionSummary: string;
  howItWorks: string[];
  benefits: string[];
  workflow: string[];
  relatedIndustrySlugs: string[];
  faqs: FaqEntry[];
}
