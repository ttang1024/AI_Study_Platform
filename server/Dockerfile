# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files for layer caching
COPY StudyPlatform.sln .
COPY StudyPlatform.API/StudyPlatform.API.csproj StudyPlatform.API/
COPY StudyPlatform.Application/StudyPlatform.Application.csproj StudyPlatform.Application/
COPY StudyPlatform.Domain/StudyPlatform.Domain.csproj StudyPlatform.Domain/
COPY StudyPlatform.Infrastructure/StudyPlatform.Infrastructure.csproj StudyPlatform.Infrastructure/

RUN dotnet restore

# Copy source and publish
COPY . .
RUN dotnet publish StudyPlatform.API/StudyPlatform.API.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Install native deps for Whisper.net, FFmpeg, and yt-dlp.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    libgomp1 \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "StudyPlatform.API.dll"]
