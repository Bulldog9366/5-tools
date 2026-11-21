# 5 Tools — Repair & Maintenance Workspace

## Access (read this before changing anything)

The app ships with a sign-in gate that is **off until you turn it on**:

1. In Supabase → Authentication → Users, create one login per person (Janet,
   office, field leads) with email + password.
2. In Vercel → the 5 Tools project → Settings → Environment Variables, add
   `NEXT_PUBLIC_REQUIRE_LOGIN = true`, then redeploy.

With the variable unset, every page behaves exactly as it does today. With it
set, a page asks for that login before it renders, and a "Sign out" button
appears bottom-right.

**The gate is not the whole lock.** The database key is still public in the
browser, so anyone who has the link could talk to the database directly. That
closes only when row-level security is on for every table the app uses
(`project_tracker`, `calendar_items`, `project_scheduler`, `service_tickets`,
`time_clock_employees`, `operations_time_entries`, `time_entries`,
`photo_review_tasks`, `operations_assistant_items`, `work_orders`,
`cost_estimates`, `admin_job_cost_invoices`, `work_order_pricing_notebook`,
`inspection_properties`, `inspection_schedule_v2`) plus the `work-order-photos`
and `inspection-photos` buckets — and each table needs policies for the
`authenticated` role, or the pages go blank. Turn that on one table at a time,
while someone can watch the app.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
