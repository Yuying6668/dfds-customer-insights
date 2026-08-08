FROM node:22-slim AS frontend-build

WORKDIR /build
COPY package.json /build/package.json
RUN npm install
COPY app /build/app
COPY vite.config.mjs /build/vite.config.mjs
RUN npm run build

FROM python:3.14-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY . /app
COPY --from=frontend-build /build/app/dist /app/app/dist

ENV HOST=0.0.0.0
ENV PORT=8766
EXPOSE 8766

CMD ["python3", "server.py"]
