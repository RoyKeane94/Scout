# Scout

## Setup & run

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate

# Frontend (build once)
cd frontend
npm install
npm run build

# Run (single server)
cd backend
python manage.py runserver
```

Open http://localhost:8000/ — landing page, register, log in, and app all work from one URL.
