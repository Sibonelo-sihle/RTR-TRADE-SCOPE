# RTR-TradeScope API

FastAPI is the only database-facing application layer. Supabase's publishable key is intentionally unused for journal CRUD. Copy `.env.example` to `.env`, set backend-only `DATABASE_URL` to the transaction-mode pooler and `DIRECT_URL` to the session-mode pooler, then run:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Tables have RLS enabled with no anonymous policies. During the pre-auth transition, `user_id` is nullable and FastAPI connects with the trusted database role. When Auth is added, make `user_id` required, validate the Supabase JWT in FastAPI, scope every query to that ID, and add `auth.uid() = user_id` policies before exposing any direct Supabase Data API access.
