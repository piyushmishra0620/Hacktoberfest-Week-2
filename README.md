# MatchForge

Resume analysis with a local Gemma 3 model (Ollama), React frontend, Express backend.

## 1. Prepare Ollama
```
ollama pull gemma3
ollama serve        # skip if Ollama is already running
```
Tip: `gemma3` = 4B by default. For better scoring quality use `gemma3:12b` and set OLLAMA_MODEL in server/.env.

## 2. Backend (port 5000)
```
cd server
npm install
cp .env.example .env
npm start
```

## 3. Frontend (port 5173)
```
cd client
npm install
npm run dev
```
Open http://localhost:5173

## Flow
1. Upload PDF/DOCX/TXT + target role
2. Server extracts text -> Gemma scores it (JSON schema enforced) -> score + fixes
3. Score >= 95 with no improvements = "Perfect resume"
4. Server fetches jobs (Remotive, Arbeitnow, optional Adzuna) and ranks them by overlap with the skills Gemma extracted
