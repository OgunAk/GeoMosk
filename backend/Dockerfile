# Sürümler global.json (SDK 9.0.320) ve ADR-0001 (.NET 9) ile uyumlu.
FROM mcr.microsoft.com/dotnet/sdk:9.0.320 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props GeoScope.sln ./
COPY GeoScope.Domain/GeoScope.Domain.csproj GeoScope.Domain/
COPY GeoScope.Application/GeoScope.Application.csproj GeoScope.Application/
COPY GeoScope.Infrastructure/GeoScope.Infrastructure.csproj GeoScope.Infrastructure/
COPY GeoScope.Api/GeoScope.Api.csproj GeoScope.Api/
RUN dotnet restore GeoScope.Api/GeoScope.Api.csproj
COPY GeoScope.Domain/ GeoScope.Domain/
COPY GeoScope.Application/ GeoScope.Application/
COPY GeoScope.Infrastructure/ GeoScope.Infrastructure/
COPY GeoScope.Api/ GeoScope.Api/
RUN dotnet publish GeoScope.Api/GeoScope.Api.csproj -c Release -o /app --no-restore

# Migration bundle: şema yalnızca bu tek seferlik iş tarafından, şema sahibi rolüyle uygulanır.
FROM build AS bundle
RUN dotnet tool install --tool-path /tools dotnet-ef --version 9.0.22
RUN /tools/dotnet-ef migrations bundle \
      --project GeoScope.Infrastructure --startup-project GeoScope.Infrastructure \
      --configuration Release --output /migrate/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:9.0.22 AS migrator
WORKDIR /migrate
COPY --from=bundle /migrate/efbundle .
USER $APP_UID
ENTRYPOINT ["sh", "-c", "exec ./efbundle --connection \"$MIGRATION_CONNECTION\""]

FROM mcr.microsoft.com/dotnet/aspnet:9.0.22 AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "GeoScope.Api.dll"]
