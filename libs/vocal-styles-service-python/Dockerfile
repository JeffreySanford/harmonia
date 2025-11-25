# Vocal Styles Service Dockerfile
FROM fedora:latest
WORKDIR /app
COPY . .
RUN dnf install -y python3 python3-pip && \
	pip3 install fastapi uvicorn redis
EXPOSE 8000
CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]