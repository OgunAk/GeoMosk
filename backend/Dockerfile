# Sürümler global.json (SDK 9.0.320) ve ADR-0001 (.NET 9) ile uyumlu.
FROM mcr.microsoft.com/dotnet/sdk:9.0.320 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props GeoMosk.sln ./
COPY GeoMosk.Domain/GeoMosk.Domain.csproj GeoMosk.Domain/
COPY GeoMosk.Application/GeoMosk.Application.csproj GeoMosk.Application/
COPY GeoMosk.Infrastructure/GeoMosk.Infrastructure.csproj GeoMosk.Infrastructure/
COPY GeoMosk.Api/GeoMosk.Api.csproj GeoMosk.Api/
RUN dotnet restore GeoMosk.Api/GeoMosk.Api.csproj
COPY GeoMosk.Domain/ GeoMosk.Domain/
COPY GeoMosk.Application/ GeoMosk.Application/
COPY GeoMosk.Infrastructure/ GeoMosk.Infrastructure/
COPY GeoMosk.Api/ GeoMosk.Api/
RUN dotnet publish GeoMosk.Api/GeoMosk.Api.csproj -c Release -o /app --no-restore

# Migration bundle: şema yalnızca bu tek seferlik iş tarafından, şema sahibi rolüyle uygulanır.
FROM build AS bundle
RUN dotnet tool install --tool-path /tools dotnet-ef --version 9.0.22
RUN /tools/dotnet-ef migrations bundle \
      --project GeoMosk.Infrastructure --startup-project GeoMosk.Infrastructure \
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
ENTRYPOINT ["dotnet", "GeoMosk.Api.dll"]
