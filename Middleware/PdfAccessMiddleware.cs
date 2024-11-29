using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace halla_measurement_1.Middleware
{
    public class PdfAccessMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<PdfAccessMiddleware> _logger;
        private readonly IConfiguration _configuration;

        public PdfAccessMiddleware(
            RequestDelegate next, 
            ILogger<PdfAccessMiddleware> logger,
            IConfiguration configuration)
        {
            _next = next;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Check if the request is for a PDF
            if (context.Request.Path.StartsWithSegments("/pdfs", out var remaining))
            {
                var fileName = remaining.Value?.TrimStart('/');
                
                // Optional: Add validation logic
                if (string.IsNullOrEmpty(fileName) || 
                    !fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync("Access denied");
                    return;
                }

                // Optional: Log PDF access
                _logger.LogInformation($"PDF accessed: {fileName}");
            }

            await _next(context);
        }
    }

    // Extension method for easy middleware registration
    public static class PdfAccessMiddlewareExtensions
    {
        public static IApplicationBuilder UsePdfAccess(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<PdfAccessMiddleware>();
        }
    }
} 