// Add this class to Models/Requests/ExportMeasurementRequest.cs
public class ExportMeasurementRequest
{
    public string Model { get; set; } = string.Empty;
    public string Mold { get; set; } = string.Empty;
    public string? Customer { get; set; }
    public string? InspectorA { get; set; }
    public string? InspectorB { get; set; }
    public string? CheckedBy { get; set; }
    public string? ApprovedBy { get; set; }
}