# Local PostgreSQL + pgvector Setup

This project can run without Docker by using PostgreSQL and pgvector installed directly on macOS.

## 1. Install Homebrew

If `brew --version` does not work in Terminal, install Homebrew first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, follow Homebrew's Terminal instructions for adding `brew` to your shell path.

## 2. Install PostgreSQL and pgvector

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
```

## 3. Create the local database

```bash
createdb dfds
```

If `createdb` is not found, add PostgreSQL to your shell path:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Then run:

```bash
createdb dfds
```

## 4. Create `.env`

Create a local `.env` file in the project root:

```text
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-chat
DATABASE_URL=postgresql://127.0.0.1:5432/dfds
HOST=127.0.0.1
PORT=8766
```

Do not put the DeepSeek key in frontend files.

## 5. Install backend Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## 6. Start the local backend

```bash
python3 server.py
```

Open:

```text
http://127.0.0.1:8766/
```

Health check:

```bash
curl http://127.0.0.1:8766/api/health
```

The first server start initializes the database schema and imports the current public evidence from `data/seed.json`.

## If PostgreSQL 16 Cannot Find pgvector

If this command fails:

```bash
psql -d dfds -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

With an error like:

```text
Could not open extension control file ".../postgresql@16/.../vector.control"
```

Use PostgreSQL 17 instead:

```bash
brew services stop postgresql@16
brew install postgresql@17 pgvector
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb dfds
/opt/homebrew/opt/postgresql@17/bin/psql -d dfds -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## Stop Docker Project Containers

If the Docker version is still running:

```bash
docker compose down
```

## Uninstall Docker Desktop

Use this only if you are sure you no longer want Docker Desktop on this Mac.

Recommended safe path:

1. Open Docker Desktop.
2. Go to Settings.
3. Choose Troubleshoot.
4. Click Uninstall.

Alternative macOS app removal:

1. Quit Docker Desktop.
2. Open Applications.
3. Move Docker.app to Trash.

Docker uninstall may remove local containers, images, and volumes.
