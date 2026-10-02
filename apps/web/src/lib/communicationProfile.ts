import type { IndustryProfile } from "@/lib/industryProfile";
import type { CommunicationTemplate } from "@/lib/communication";

/**
 * Determines whether a communication template is relevant and applicable
 * for the tenant's active business / industry profile.
 */
export function isTemplateApplicableForProfile(
  template: { slug: string; category?: string },
  profile: IndustryProfile | null | undefined
): boolean {
  if (!profile) return true; // If profile is not yet available, do not restrict

  const profileSlug = profile.slug || "";
  const profileCategory = profile.category || "";
  const modules = profile.enabled_modules || [];

  const isEducationProfile =
    profileSlug === "school_education" ||
    profileCategory === "education" ||
    modules.includes("education");

  const isContractorProfile =
    profileSlug === "construction_contractor" ||
    modules.includes("subcontractor") ||
    modules.includes("boq");

  const hasDispatch =
    modules.includes("dispatch") ||
    modules.includes("fleet") ||
    (!isEducationProfile && profileCategory !== "services" && profileCategory !== "laboratory");

  const templateSlug = template.slug;
  const templateCategory = template.category || "";

  // 1. Education specific templates (student absence, fee invoice, admission status)
  const isEducationTemplate =
    templateSlug === "student_absent" ||
    templateSlug === "fee_invoice" ||
    templateSlug === "admission_status" ||
    templateCategory === "attendance" ||
    templateCategory === "fees" ||
    templateCategory === "education";

  if (isEducationTemplate) {
    return isEducationProfile;
  }

  // 2. Contractor specific templates (BOQ RA Bill)
  const isContractorTemplate =
    templateSlug === "boq_ra_bill" || templateCategory === "contractor";

  if (isContractorTemplate) {
    return isContractorProfile;
  }

  // 3. Dispatch specific templates (Delivery Challan, Dispatch Alert)
  const isDispatchTemplate =
    templateSlug === "dispatch_challan" ||
    templateSlug === "dispatch_alert" ||
    templateCategory === "dispatch";

  if (isDispatchTemplate) {
    return hasDispatch;
  }

  // 4. Commercial sales & trade templates (orders, quotes, invoices, payment reminders)
  const isCommercialSalesTemplate =
    templateSlug === "quote_created" ||
    templateSlug === "order_confirmation" ||
    templateSlug === "invoice_created" ||
    templateSlug === "invoice_share" ||
    templateSlug === "payment_reminder";

  if (isCommercialSalesTemplate && isEducationProfile) {
    // Schools use fee invoices and attendance rather than commercial trade sales orders/quotes
    return false;
  }

  // General templates or user-created custom templates remain visible
  return true;
}

/**
 * Filter an array of templates to only those matching the business profile.
 */
export function filterTemplatesForProfile(
  templates: CommunicationTemplate[] | undefined,
  profile: IndustryProfile | null | undefined
): CommunicationTemplate[] {
  if (!templates) return [];
  return templates.filter((tpl) => isTemplateApplicableForProfile(tpl, profile));
}
