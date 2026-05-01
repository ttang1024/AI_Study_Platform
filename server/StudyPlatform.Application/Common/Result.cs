namespace StudyPlatform.Application.Common;

public class Result<T>
{
    public bool IsSuccess { get; private set; }
    public T? Data { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public string? ErrorCode { get; private set; }
    public IEnumerable<string> Errors { get; private set; } = Enumerable.Empty<string>();

    private Result() { }

    public static Result<T> Success(T data, string message = "Operation successful")
    {
        return new Result<T>
        {
            IsSuccess = true,
            Data = data,
            Message = message
        };
    }

    public static Result<T> Failure(string message, string? errorCode = null, IEnumerable<string>? errors = null)
    {
        return new Result<T>
        {
            IsSuccess = false,
            Message = message,
            ErrorCode = errorCode,
            Errors = errors ?? Enumerable.Empty<string>()
        };
    }
}

public class Result
{
    public bool IsSuccess { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public string? ErrorCode { get; private set; }
    public IEnumerable<string> Errors { get; private set; } = Enumerable.Empty<string>();

    private Result() { }

    public static Result Success(string message = "Operation successful")
    {
        return new Result
        {
            IsSuccess = true,
            Message = message
        };
    }

    public static Result Failure(string message, string? errorCode = null, IEnumerable<string>? errors = null)
    {
        return new Result
        {
            IsSuccess = false,
            Message = message,
            ErrorCode = errorCode,
            Errors = errors ?? Enumerable.Empty<string>()
        };
    }
}
