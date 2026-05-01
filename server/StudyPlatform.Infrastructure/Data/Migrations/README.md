# EF Core Migrations

Run the following command from the solution root to create the initial migration:

```bash
dotnet ef migrations add InitialCreate \
  --project StudyPlatform.Infrastructure \
  --startup-project StudyPlatform.API \
  --output-dir Data/Migrations

dotnet ef database update \
  --project StudyPlatform.Infrastructure \
  --startup-project StudyPlatform.API
```
