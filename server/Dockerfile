# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files for layer caching
COPY StudyPlatform.sln .
COPY StudyPlatform.API/StudyPlatform.API.csproj StudyPlatform.API/
COPY StudyPlatform.Application/StudyPlatform.Application.csproj StudyPlatform.Application/
COPY StudyPlatform.Domain/StudyPlatform.Domain.csproj StudyPlatform.Domain/
COPY StudyPlatform.Infrastructure/StudyPlatform.Infrastructure.csproj StudyPlatform.Infrastructure/

# Restore the API project, not the solution: the solution also references StudyPlatform.Tests, whose
# csproj is deliberately not copied here (the image ships no tests), and `dotnet restore` on the .sln
# fails with MSB3202 on that missing project. The API transitively pulls in Application, Domain and
# Infrastructure, so this restores everything the publish below needs and nothing it does not.
RUN dotnet restore StudyPlatform.API/StudyPlatform.API.csproj

# Copy source and publish
COPY . .
RUN dotnet publish StudyPlatform.API/StudyPlatform.API.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Pinned so a rebuild is reproducible. yt-dlp in particular breaks and gets fixed often as YouTube
# changes: when caption fetching starts failing, bump YT_DLP_VERSION (or pass --build-arg) deliberately.
ARG YT_DLP_VERSION=2026.8.19
ARG EDGE_TTS_VERSION=7.2.8

# Install native deps for Whisper.net, FFmpeg, and yt-dlp.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    libgomp1 \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir "yt-dlp==${YT_DLP_VERSION}" "edge-tts==${EDGE_TTS_VERSION}" --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Run as the image's unprivileged `app` user (APP_UID), not root: the process shells out to yt-dlp,
# ffmpeg and edge-tts on user-supplied media, so a compromise there shouldn't own the container. The
# application files stay root-owned (read-only to it); only the two directories it writes to at runtime
# are its own: downloaded Whisper models, and DataProtection keys (deploy.sh mounts a volume over that).
RUN mkdir -p /app/whisper-models /home/app/.aspnet/DataProtection-Keys \
    && chown -R $APP_UID /app/whisper-models /home/app/.aspnet
USER $APP_UID

ENV ASPNETCORE_HTTP_PORTS=5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "StudyPlatform.API.dll"]
