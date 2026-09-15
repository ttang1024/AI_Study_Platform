using Xunit;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>
/// Inputs shared by validators that enforce the same rule in more than one place.
///
/// <para>Sharing the samples — rather than the tests — keeps each validator's suite independent
/// while making sure they are all held to the same bar: before this, the create and update course
/// validators enforced one regex but were checked against different colours.</para>
/// </summary>
public static class ValidationCases
{
    /// <summary>Rejected by <c>PasswordPolicy</c>: 8–20 chars with upper, lower and a digit.</summary>
    public static TheoryData<string> WeakPasswords =>
    [
        "short1!",                 // under 8
        "alllowercase1",           // no uppercase
        "NoDigitsHere",            // no digit
        "ALLUPPERCASE1",           // no lowercase
        "ThisPasswordIsTooLong1!", // over 20
        "",
    ];

    public static TheoryData<string> InvalidHexColors =>
    [
        "",
        "notahex",
        "#GGGGGG",  // non-hex characters
        "#ZZZZZZ",
        "#12345",   // five digits
        "3B82F6",   // missing #
    ];

    public static TheoryData<string> ValidHexColors =>
    [
        "#3B82F6",  // 6-digit
        "#fff",     // 3-digit lowercase
        "#ABC",     // 3-digit uppercase
        "#aabbcc",  // 6-digit lowercase
    ];
}
