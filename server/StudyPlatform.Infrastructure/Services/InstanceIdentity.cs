using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

public sealed class InstanceIdentity : IInstanceIdentity
{
    public string Id { get; } =
        $"{Environment.MachineName}:{Environment.ProcessId}:{Guid.NewGuid():N}";

    public InstanceIdentity()
    {
        if (Id.Length > 64) Id = Id[..64];
    }
}
