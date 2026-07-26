namespace StudyPlatform.Domain.Entities;

/// <summary>
/// An institution (school, department, bootcamp) that owns classrooms and can hold a paid plan.
///
/// This is the first entity in the schema that sits *above* a user. Everything else is scoped by
/// the JWT user id; an organization deliberately is not, because its whole purpose is to let an
/// instructor see other people's work. Cross-user reads therefore only ever happen through an
/// explicit membership check — see <see cref="OrganizationMember"/> and ClassroomEnrollment.
/// </summary>
public class Organization
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>URL-safe identifier used in invite links. Unique across the platform.</summary>
    public string Slug { get; set; } = string.Empty;

    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User Owner { get; set; } = null!;
    public ICollection<OrganizationMember> Members { get; set; } = new List<OrganizationMember>();
    public ICollection<Classroom> Classrooms { get; set; } = new List<Classroom>();
}

/// <summary>Roles a user can hold inside an organization, most privileged first.</summary>
public static class OrganizationRoles
{
    public const string Owner = "owner";
    public const string Admin = "admin";
    public const string Instructor = "instructor";
    public const string Member = "member";

    public static readonly string[] All = { Owner, Admin, Instructor, Member };

    /// <summary>Roles allowed to create classrooms and read other members' work.</summary>
    public static bool CanTeach(string role) => role is Owner or Admin or Instructor;

    /// <summary>Roles allowed to change the organization itself (rename, billing, membership).</summary>
    public static bool CanAdminister(string role) => role is Owner or Admin;
}

public class OrganizationMember
{
    public Guid OrganizationMemberId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>One of <see cref="OrganizationRoles"/>.</summary>
    public string Role { get; set; } = OrganizationRoles.Member;

    public DateTime JoinedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User User { get; set; } = null!;
}
