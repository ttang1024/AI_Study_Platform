using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Integration;

/// <summary>
/// Boots the real API composition (Program.cs and every registration it makes) against a real database
/// and resolves every request handler, controller and SignalR hub. Handlers take exactly the repositories and services
/// they use, so a dependency nobody registered would otherwise surface only when that endpoint is first
/// called in production.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiCompositionTests
{
    private readonly PostgresFixture _db;

    public ApiCompositionTests(PostgresFixture db) => _db = db;

    private WebApplicationFactory<Program> Api() => new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", _db.ConnectionString);
        builder.UseSetting("JwtSettings:SecretKey", new string('k', 64));
        builder.UseSetting("Redis:Enabled", "false");
        builder.UseSetting("S3:BucketName", "composition-test");
    });

    [DockerFact]
    public void EveryRequestHandlerControllerAndHub_Resolves()
    {
        using var factory = Api();
        using var scope = factory.Services.CreateScope();
        var services = scope.ServiceProvider;

        var handlerInterfaces = typeof(StudyPlatform.Application.DependencyInjection).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false, IsGenericTypeDefinition: false })
            .SelectMany(t => t.GetInterfaces())
            .Where(i => i.IsGenericType
                && (i.GetGenericTypeDefinition() == typeof(IRequestHandler<,>) || i.GetGenericTypeDefinition() == typeof(IRequestHandler<>)))
            .Distinct()
            .ToList();

        var controllers = typeof(Program).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                && (typeof(ControllerBase).IsAssignableFrom(t) || typeof(Microsoft.AspNetCore.SignalR.Hub).IsAssignableFrom(t)))
            .ToList();

        var failures = new List<string>();
        foreach (var handler in handlerInterfaces)
            Try(handler.ToString(), () => services.GetRequiredService(handler));
        foreach (var controller in controllers)
            Try(controller.Name, () => ActivatorUtilities.CreateInstance(services, controller));

        Assert.True(handlerInterfaces.Count > 100, $"only found {handlerInterfaces.Count} handlers");
        Assert.True(failures.Count == 0, "Could not resolve:\n" + string.Join("\n", failures));

        void Try(string name, Action resolve)
        {
            try { resolve(); }
            catch (Exception ex) { failures.Add($"{name}: {ex.GetBaseException().Message}"); }
        }
    }

    [DockerFact]
    public async Task SeparatelyInjectedRepositories_ShareOneUnitOfWork()
    {
        using var factory = Api();
        var userId = Guid.NewGuid();
        var courseId = Guid.NewGuid();

        // Two repositories and the unit of work, resolved independently from one request scope, as a
        // handler's constructor would get them: one SaveChangesAsync must commit both repositories' changes.
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            var courses = scope.ServiceProvider.GetRequiredService<ICourseRepository>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            await users.AddAsync(new User
            {
                UserId = userId, Email = $"{userId:N}@example.com", FullName = "U", PasswordHash = "x",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            await courses.AddAsync(new Course
            {
                CourseId = courseId, UserId = userId, CourseName = "C", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            await unitOfWork.SaveChangesAsync();
        }

        using (var scope = factory.Services.CreateScope())
        {
            Assert.NotNull(await scope.ServiceProvider.GetRequiredService<IUserRepository>().GetByIdAsync(userId));
            Assert.NotNull(await scope.ServiceProvider.GetRequiredService<ICourseRepository>().GetByIdAsync(courseId));
        }
    }
}
