# Tests

## Backend

Backend tests live in `server/StudyPlatform.Tests`.

Current coverage areas include:

- auth command handlers and validators
- course validators and handlers
- document generation handlers
- flashcard command handlers
- FSRS service
- glossary mastery
- notes
- document content service

Run from repo root:

```bash
dotnet test server/StudyPlatform.sln
```

### Pattern — Moq + xUnit

Tests mock `IUnitOfWork` and its repository properties, then verify both the return value and the repository interactions. Example from `FlashcardCommandHandlerTests`:

```csharp
// FlashcardCommandHandlerTests.cs
public CreateFlashcardCommandHandlerTests()
{
    _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
    _uow.Setup(u => u.Documents).Returns(_documents.Object);
    _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default)).Returns(Task.CompletedTask);
    _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
    _handler = new CreateFlashcardCommandHandler(_uow.Object);
}

[Fact]
public async Task Handle_WithoutDocument_CreatesFlashcard()
{
    var result = await _handler.Handle(new CreateFlashcardCommand(_userId, "Front", "Back"), default);

    Assert.True(result.IsSuccess);
    Assert.Equal("Front", result.Data!.Front);
    _flashcards.Verify(r => r.AddAsync(It.IsAny<Flashcard>(), default), Times.Once);
    _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
}
```

Toggle-style commands test both branches (mark and unmark):

```csharp
// WorkedProblemMasteredCommandHandlerTests.cs
[Fact]
public async Task Handle_NotYetMastered_CreatesEntryAndReturnsTrue()
{
    _masteredRepo.Setup(r => r.GetByUserAndProblemAsync(_userId, _problemId, default))
        .ReturnsAsync((WorkedProblemMastered?)null);

    var result = await _handler.Handle(
        new ToggleWorkedProblemMasteredCommand(_userId, _problemId), default);

    Assert.True(result.Data);  // marked = true
    _masteredRepo.Verify(r => r.AddAsync(
        It.Is<WorkedProblemMastered>(m => m.UserId == _userId && m.WorkedProblemId == _problemId),
        default), Times.Once);
}

[Fact]
public async Task Handle_AlreadyMastered_RemovesEntryAndReturnsFalse()
{
    _masteredRepo.Setup(r => r.GetByUserAndProblemAsync(_userId, _problemId, default))
        .ReturnsAsync(existing);

    var result = await _handler.Handle(
        new ToggleWorkedProblemMasteredCommand(_userId, _problemId), default);

    Assert.False(result.Data);  // unmarked = false
    _masteredRepo.Verify(r => r.Remove(existing), Times.Once);
    _masteredRepo.Verify(r => r.AddAsync(It.IsAny<WorkedProblemMastered>(), default), Times.Never);
}
```

## Web

Web tests use Vitest and Playwright.

```bash
cd web
npm run test
npm run test:e2e
```

Unit tests live beside `web/src/**/__tests__`. E2E tests live in `web/e2e`.

## Admin

Admin has TypeScript checking through:

```bash
cd admin
npm run lint
```
