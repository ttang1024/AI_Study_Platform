namespace StudyPlatform.Application.Common;

public class BaseResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorCode { get; set; }
    public IEnumerable<string> Errors { get; set; } = Enumerable.Empty<string>();
}

public class BaseResponse<T> : BaseResponse
{
    public T? Data { get; set; }

    public static BaseResponse<T> Ok(T data, string message = "Operation successful")
    {
        return new BaseResponse<T>
        {
            Success = true,
            Message = message,
            Data = data
        };
    }

    public static BaseResponse<T> Fail(string message, string? errorCode = null, IEnumerable<string>? errors = null)
    {
        return new BaseResponse<T>
        {
            Success = false,
            Message = message,
            ErrorCode = errorCode,
            Errors = errors ?? Enumerable.Empty<string>()
        };
    }
}
