FROM python:3.14-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY . /app

ENV PORT=8766
EXPOSE 8766

CMD ["python3", "server.py"]
