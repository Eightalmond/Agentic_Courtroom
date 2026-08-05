import type { ProductDefinition } from "./types";

export const flowPilotProduct: ProductDefinition = {
  id: "flowpilot",
  name: "FlowPilot",
  description:
    "A workflow automation platform that helps small teams connect routine work, approvals, and notifications.",
  disclaimer:
    "FlowPilot is a fictional company created for controlled product-testing scenarios. It is not a real service.",
  pages: [
    {
      slug: "product-overview",
      title: "Product overview",
      summary: "Learn how FlowPilot helps small teams create and monitor automated workflows.",
      category: "Product",
      sections: [
        {
          heading: "What FlowPilot does",
          paragraphs: [
            "FlowPilot lets small teams build repeatable workflows from triggers, actions, and approval steps. A workflow might route a request for approval, update a shared record, and notify the right channel when work is complete.",
            "Teams can begin with a template or build from a blank workflow. Every plan includes workflow history, CSV export, and the core visual builder.",
          ],
        },
        {
          heading: "How workspaces are organized",
          paragraphs: [
            "Each FlowPilot account belongs to a workspace. Workspace roles determine who can edit settings, build workflows, or view shared work. Subscription management and workspace deletion are separate account actions.",
          ],
          bullets: [
            "Triggers start a workflow when a configured event occurs.",
            "Actions carry out the next step in sequence.",
            "Approval steps pause a run until an authorized teammate responds.",
          ],
        },
      ],
      relatedSlugs: ["pricing", "team-permissions", "data-export"],
      keywords: ["workflow", "automation", "workspace", "triggers", "actions"],
    },
    {
      slug: "pricing",
      title: "Pricing",
      summary: "Compare FlowPilot plans, per-user prices, and their headline features.",
      category: "Plans & billing",
      sections: [
        {
          heading: "Starter — $12 per user per month",
          paragraphs: [
            "Starter covers the core workflow builder for teams with straightforward administration needs.",
          ],
          bullets: ["Admin and Member roles", "Workflow data export as CSV", "Core workflow history"],
        },
        {
          heading: "Pro — $29 per user per month",
          paragraphs: [
            "Pro includes a 14-day free trial and adds developer access and more flexible participation.",
          ],
          bullets: ["Everything in Starter", "API access included", "Admin, Member, and Viewer roles"],
        },
        {
          heading: "Business — $59 per user per month",
          paragraphs: [
            "Business is designed for teams that need stronger governance, identity controls, and higher-capacity developer access.",
          ],
          bullets: [
            "Everything in Pro",
            "Custom roles and single sign-on",
            "Full audit-log export",
            "Higher API allowance",
          ],
        },
      ],
      relatedSlugs: ["free-trial-and-billing", "api-access", "team-permissions"],
      keywords: ["plans", "price", "starter", "pro", "business", "trial"],
      callouts: [
        {
          type: "info",
          title: "Prices are per user",
          content: "Displayed prices are monthly per-user rates and do not include applicable taxes.",
        },
      ],
    },
    {
      slug: "free-trial-and-billing",
      title: "Free trial and billing",
      summary: "Understand the Pro trial, card requirement, and what happens when the trial ends.",
      category: "Plans & billing",
      sections: [
        {
          heading: "Starting the Pro trial",
          paragraphs: [
            "The Pro plan includes a 14-day free trial. A payment card is required to begin, but the card is not charged when the trial starts.",
            "The trial begins as soon as the workspace confirms its plan and card details. Trial availability applies to Pro; Starter and Business do not include this trial offer.",
          ],
        },
        {
          heading: "Automatic billing after the trial",
          paragraphs: [
            "FlowPilot automatically charges the saved payment card for Pro when the 14-day trial ends unless the subscription is cancelled first. The first paid billing period begins immediately after the trial.",
            "Cancelling during the trial prevents the first charge. Trial features remain available until the original end of the 14-day trial period, even after cancellation.",
          ],
        },
      ],
      relatedSlugs: ["pricing", "cancellation-policy", "refund-policy"],
      keywords: ["trial", "payment card", "automatic billing", "charge", "pro"],
      callouts: [
        {
          type: "warning",
          title: "The trial converts automatically",
          content: "Cancel before the end of day 14 to prevent the first Pro subscription charge.",
        },
      ],
    },
    {
      slug: "cancellation-policy",
      title: "Cancellation policy",
      summary: "See when cancellation takes effect and how long a workspace remains accessible.",
      category: "Plans & billing",
      sections: [
        {
          heading: "Cancelling a paid subscription",
          paragraphs: [
            "Paid Starter, Pro, and Business subscriptions can be cancelled at any time. Cancellation takes effect at the end of the current billing period, and the workspace remains accessible on its paid plan until that date.",
            "A cancellation stops the next scheduled renewal. It does not reverse a charge that has already been processed.",
          ],
        },
        {
          heading: "Cancelling during a trial",
          paragraphs: [
            "Cancelling a Pro trial before day 14 prevents the first charge. The workspace keeps Pro trial access until the trial's scheduled end date.",
          ],
        },
      ],
      relatedSlugs: ["free-trial-and-billing", "refund-policy", "data-export"],
      keywords: ["cancel", "subscription", "billing period", "workspace", "delete"],
      callouts: [
        {
          type: "warning",
          title: "Cancellation does not delete the workspace",
          content:
            "Deleting a workspace is a separate action in workspace settings. Export any needed data before deletion, because deletion removes workspace content rather than only ending billing.",
        },
      ],
    },
    {
      slug: "refund-policy",
      title: "Refund policy",
      summary: "Review when FlowPilot may investigate a duplicate charge or another billing error.",
      category: "Plans & billing",
      sections: [
        {
          heading: "General policy",
          paragraphs: [
            "Subscription charges are generally non-refundable. Cancelling after a renewal does not automatically create a refund, because cancellation applies at the end of the active billing period.",
          ],
        },
        {
          heading: "Duplicate charges and billing errors",
          paragraphs: [
            "FlowPilot may refund a confirmed duplicate charge. Customers who believe a charge resulted from another billing error should contact support within seven days of the charge so the billing team can investigate.",
            "Contacting support does not guarantee a refund. FlowPilot reviews the account history and payment record before deciding whether an adjustment is appropriate.",
          ],
        },
      ],
      relatedSlugs: ["cancellation-policy", "free-trial-and-billing"],
      keywords: ["refund", "duplicate charge", "billing error", "renewal", "seven days"],
      callouts: [
        {
          type: "info",
          title: "Cancellation and refunds are separate",
          content: "Stopping a future renewal does not automatically refund the current subscription period.",
        },
      ],
    },
    {
      slug: "api-access",
      title: "API access",
      summary: "Learn which plans can create API tokens and what those tokens can access.",
      category: "Developers",
      sections: [
        {
          heading: "Plan availability",
          paragraphs: [
            "API access is available on Pro and Business. Starter does not include API access, so Starter workspaces cannot create or use API tokens.",
            "Workspace Admins can create tokens from developer settings. Tokens inherit access to their workspace and should be stored like passwords.",
          ],
        },
        {
          heading: "Using the API",
          paragraphs: [
            "The FlowPilot API can read workflow definitions, inspect run status, and start eligible workflows. API usage counts toward both a monthly plan allowance and short-term rate limits.",
          ],
        },
      ],
      relatedSlugs: ["api-rate-limits", "pricing", "team-permissions"],
      keywords: ["api", "developer", "token", "pro", "business", "starter"],
    },
    {
      slug: "api-rate-limits",
      title: "API rate limits",
      summary: "Check monthly API allowances and short-term request limits for eligible plans.",
      category: "Developers",
      sections: [
        {
          heading: "Monthly request allowances",
          paragraphs: [
            "Pro workspaces can make up to 10,000 API requests per month. Business workspaces can make up to 100,000 API requests per month. Starter has no API allowance because API access is unavailable on that plan.",
            "Monthly allowances reset at the beginning of the workspace's billing period. Unused requests do not carry forward.",
          ],
        },
        {
          heading: "Short-term limits",
          paragraphs: [
            "Short-term rate limits also apply to protect service stability: Pro permits 60 requests per minute, and Business permits 300 requests per minute. Requests above these limits receive a rate-limit response and can be retried after the indicated interval.",
            "A workspace can reach a short-term limit even when it has requests remaining in its monthly allowance.",
          ],
        },
      ],
      relatedSlugs: ["api-access", "pricing"],
      keywords: ["api", "rate limit", "requests", "allowance", "quota", "monthly"],
      callouts: [
        {
          type: "info",
          title: "Two limits apply",
          content: "Requests must remain within both the monthly allowance and the plan's per-minute limit.",
        },
      ],
    },
    {
      slug: "team-permissions",
      title: "Team permissions",
      summary: "Compare workspace roles and permission options across FlowPilot plans.",
      category: "Workspace administration",
      sections: [
        {
          heading: "Standard roles",
          paragraphs: [
            "Starter provides two roles: Admin and Member. Admins manage workspace settings, billing, and workflows, while Members can create and edit workflows without controlling billing.",
            "Pro and Business also include a Viewer role. Viewers can inspect shared workflows and run history but cannot edit workflows or settings.",
          ],
        },
        {
          heading: "Custom roles on Business",
          paragraphs: [
            "Business includes custom roles. An Admin can combine individual permissions to create roles for responsibilities such as workflow review, incident response, or reporting.",
            "Custom roles do not replace the built-in Admin role, and at least one Admin must remain in every workspace.",
          ],
        },
      ],
      relatedSlugs: ["pricing", "security-and-privacy", "product-overview"],
      keywords: ["roles", "permissions", "admin", "member", "viewer", "custom roles"],
    },
    {
      slug: "data-export",
      title: "Data export",
      summary: "Export workflow data and understand which plan includes full audit-log export.",
      category: "Data & security",
      sections: [
        {
          heading: "Workflow CSV export",
          paragraphs: [
            "All plans can export workflow data as CSV. The export includes workflow names, current status, recent run outcomes, and the selected date range.",
            "Admins and Members can create workflow CSV exports. Viewers on Pro and Business can download exports that an authorized teammate has shared with them.",
          ],
        },
        {
          heading: "Audit-log export",
          paragraphs: [
            "Full audit-log export is available only on Business. It includes workspace security and administration events in addition to workflow activity.",
            "Starter and Pro retain viewable workflow history but do not provide the complete audit log as an export file.",
          ],
        },
      ],
      relatedSlugs: ["security-and-privacy", "team-permissions", "cancellation-policy"],
      keywords: ["export", "csv", "workflow data", "audit log", "business"],
    },
    {
      slug: "security-and-privacy",
      title: "Security and privacy",
      summary: "Review FlowPilot's encryption, single sign-on availability, and compliance boundaries.",
      category: "Data & security",
      sections: [
        {
          heading: "Data protection",
          paragraphs: [
            "FlowPilot encrypts data in transit and at rest. Access to production systems is restricted to authorized personnel and logged for security review.",
            "Customers remain responsible for configuring workspace roles appropriately and for protecting credentials and API tokens.",
          ],
        },
        {
          heading: "Identity and compliance",
          paragraphs: [
            "Single sign-on is available only on Business. Starter and Pro users sign in with their individual FlowPilot credentials.",
            "FlowPilot does not claim to be HIPAA compliant and should not be used to store protected health information. Teams with regulated-data requirements should evaluate those requirements before using the service.",
          ],
        },
      ],
      relatedSlugs: ["team-permissions", "data-export", "api-access"],
      keywords: ["security", "privacy", "encryption", "sso", "hipaa", "data"],
      callouts: [
        {
          type: "warning",
          title: "Not HIPAA compliant",
          content: "FlowPilot does not claim HIPAA compliance. Do not store protected health information in FlowPilot.",
        },
      ],
    },
  ],
} as const;
