## SEP Internal Management Portal

- Next.js 14 (App Router)
- TypeScript + ESLint
- Supabase (Auth & Database)
- Tailwind CSS + shadcn/ui components

## Requirements

- Recommended Node.js version: v22.20.0

### Local Development

```bash
npm install
npm run dev
```

Create a `.env.local` with your Supabase project credentials:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Visit `http://localhost:3000` after the dev server starts.

### Building for Production

```bash
npm run build
npm run start
```
