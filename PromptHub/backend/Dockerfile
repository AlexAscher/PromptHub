FROM alpine:3.20

ARG PB_VERSION=0.40.6

# Архитектура определяется по самой сборочной машине (uname -m), чтобы на
# Apple Silicon скачивался arm64-бинарник, а не amd64 под эмуляцией.
RUN apk add --no-cache ca-certificates unzip wget \
    && case "$(uname -m)" in \
         x86_64) ARCH=amd64 ;; \
         aarch64|arm64) ARCH=arm64 ;; \
         armv7l) ARCH=armv7 ;; \
         *) echo "Неподдерживаемая архитектура: $(uname -m)" && exit 1 ;; \
       esac \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" -O /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks

WORKDIR /pb
EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
