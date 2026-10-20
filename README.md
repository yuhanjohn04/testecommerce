# Minimal Django + Next.js store

## Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_products
python manage.py createsuperuser
python manage.py runserver 8001
```

API: `http://127.0.0.1:8001/api/`  
Django admin: `http://127.0.0.1:8001/admin/`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Storefront: `http://localhost:3000`  
Store admin: `http://localhost:3000/admin`
