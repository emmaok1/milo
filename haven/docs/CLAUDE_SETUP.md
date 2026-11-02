# Local Claude setup

The app now uses the native Anthropic API. An official Anthropic key is required; third-party gateway keys are not accepted by this configuration. No OpenAI key is required. Supabase still supplies live authentication and application storage.

## 1. Fill the local environment

Edit `haven/.env.local` (the file is ignored by Git). Keep the existing internal memory token and add your actual key after `=`:

```dotenv
ANTHROPIC_API_KEY=replace_with_your_actual_anthropic_key
ANTHROPIC_CHAT_MODEL=claude-sonnet-5-5
ANTHROPIC_PLAN_MODEL=claude-sonnet-5-5
ANTHROPIC_MEMORY_MODEL=claude-haiku-5-5
```

Obtain/manage official keys at https://platform.claude.com/settings/keys. Do not paste keys into chat, screenshots, browser code, or a `NEXT_PUBLIC_` variable. Model availability and billing must be enabled for your account.

Preserve/set the Supabase values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace_with_publishable_key
SUPABASE_SERVICE_ROLE_KEY=replace_with_server_secret_key
APP_ORIGIN=http://localhost:3000
MEMORY_SERVICE_URL=http://127.0.0.1:8001
MEMORY_SERVICE_TOKEN=keep_the_existing_generated_token
```

Apply `supabase/migrations/001_haven.sql` to a fresh development project. Configure Supabase email/password authentication and the callback URLs described in README. A Claude key alone does not set up the database or sign-in flow.

## 2. Start the services

From `haven/`:

```bash
docker compose up --build -d
npm run verify:services
```

The first image build downloads CPU dependencies and public MiniLM weights and can take several minutes. Embedding inference then stays local; memory extraction sends selected text to Anthropic. No Hugging Face, Mem0 Cloud, or embedding-provider key is required for this public model. New vectors use their own collection; do not delete existing volumes to switch providers.

Optional small billed generation checks:

```bash
npm run verify:services -- --smoke
```

The checks deliberately do not print keys or raw provider errors. Mem0 health only confirms its HTTP process; it does not verify extraction, embeddings, or persistence. Those flows still need a fictional live end-to-end test after credentials are configured.

## 3. Use a live account

Keep `DEMO_ENABLED=true` while checking setup. After live services and the database are ready, set:

```dotenv
DEMO_ENABLED=false
```

Restart Next.js and the memory container after changing credentials:

```bash
docker compose up -d --force-recreate memory
npm run dev
```

Run the worker in another terminal:

```bash
npm run worker
```

Open http://localhost:3000, sign out of any existing fictional demo session, and register/sign in through Supabase. The fictional demo always uses scripted replies, even with a valid Claude key. Setting `DEMO_ENABLED=false` blocks new demo sessions; existing demo cookies must also be cleared by signing out.

## Verification limits

Local tests mock the Claude HTTP responses to exercise native request format, structured output validation, streaming, and incomplete-output handling without spending credits. A successful build is not evidence of a successful live Claude call. Real generation and full memory persistence can only be verified once credentials are supplied.

Official references:

- https://platform.claude.com/docs/en/models/overview
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
