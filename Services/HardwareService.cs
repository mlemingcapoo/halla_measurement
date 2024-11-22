using System.Diagnostics;
// using Microsoft.AspNetCore.Mvc;
using ElectronNET.API;
using halla_measurement_1.Models;
using Services;
using System.Text;
using System.IO.Ports;

namespace Services
{
    public class HardwareService : IIPCService
    {
        private readonly ILogger<HardwareService> _logger;
        private readonly ComPortService _comPortService;
        private BrowserWindow? _window;
        private SerialPort? _connectedPort;
        public HardwareService(ILogger<HardwareService> logger, ComPortService comPortService)
        {
            _logger = logger;
            _comPortService = comPortService;
            _comPortService.MeasurementDataReceived += OnMeasurementDataReceived;
            _comPortService.ReceiverStatusReceived += OnReceiverStatusReceived;
            _comPortService.TransmitterInfoReceived += OnTransmitterInfoReceived;
            _comPortService.GenericDataReceived += OnGenericDataReceived;

            _comPortService.CommandError += OnCommandError;
        }

        private void OnCommandError(object? sender, string errorMessage)
        {
            _logger.LogError("Command error: " + errorMessage);
            if (_window != null)
            {
                _logger.LogInformation("Command error string: " + errorMessage);
                Electron.IpcMain.Send(_window, "command-error", errorMessage);
            }
        }

        // receive data from serial port
        private void OnMeasurementDataReceived(object? sender, string data)
        {
            _logger.LogInformation("Measurement data received: " + data);
            if (_window != null)
            {
                // DT
                _logger.LogInformation("Measurement data string: " + data);
                var measurementData = ProcessMeasurementData(data);
                Electron.IpcMain.Send(_window, "measurement-data-received", measurementData);
            }
        }

        private void OnReceiverStatusReceived(object? sender, string data)
        {
            _logger.LogInformation("Receiver status received: " + data);
            if (_window != null)
            {
                // RI
                _logger.LogInformation("Receiver status string: " + data);
                var statusString = ProcessReceiverStatusString(data);
                Electron.IpcMain.Send(_window, "receiver-status-received", statusString.Replace("\n", "<br>"));
            }
        }

        private void OnTransmitterInfoReceived(object? sender, string data)
        {
            _logger.LogInformation("Transmitter status received: " + data);
            if (_window != null)
            {
                // TI
                _logger.LogInformation("Transmitter status string: " + data);
                Electron.IpcMain.Send(_window, "transmitter-status-received", data);
            }
        }

        private void OnGenericDataReceived(object? sender, string data)
        {
            // generic or actually ST lol
            _logger.LogInformation("Generic data received: " + data);
            if (_window != null)
            {
                if (data.StartsWith("ST"))
                {
                    // implement status received
                    _logger.LogInformation("Status received: " + data);
                    // status string: ST10007010001547801
                    // ST: status packet
                    // 1: API version
                    // 00: group id
                    // 01: channel
                    // 000154780: device id
                    // 01: status code
                    var statusString = ProcessTransmitterStatusString(data);
                    _logger.LogInformation("Status string: " + statusString);
                    Electron.IpcMain.Send(_window, "status-received", statusString);
                }
                else
                {
                    // maybe it's a measurement data
                    if (data.StartsWith("DT"))
                    {
                        _logger.LogInformation("Measurement data received: " + data);
                        var measurementData = ProcessMeasurementData(data);
                        Electron.IpcMain.Send(_window, "measurement-data-received", measurementData);
                    }
                    else
                    {
                        _logger.LogInformation("Unknown data received: " + data);
                        Electron.IpcMain.Send(_window, "generic-data-received", data);
                    }
                }
            }
        }

        private string ProcessReceiverStatusString(string data)
        {
            // RI10010000330301190255255255255255255255255255255255255255255255255
            if (!data.StartsWith("RI"))
            {
                return "Dữ liệu không hợp lệ: không phải gói tin thông tin bộ nhận";
            }

            var version = data.Substring(2, 1); // 1 byte
            var groupId = data.Substring(3, 2); // 2 bytes
            var deviceId = data.Substring(5, 10); // 10 bytes
            var bandId = data.Substring(15, 2); // 2 bytes
            var dataLackCheckLevel = data.Substring(17, 1); // 1 byte
            var duplicateState = data.Substring(18, 1); // 1 byte

            var result = new StringBuilder();
            result.AppendLine($"Thông tin bộ nhận U-WAVE-R:");
            result.AppendLine($"- Phiên bản API: {version}");
            result.AppendLine($"- ID nhóm: {groupId}");
            result.AppendLine($"- ID thiết bị: {deviceId}");
            result.AppendLine($"- ID băng tần: {bandId}");
            result.AppendLine($"- Mức kiểm tra thiếu dữ liệu: {dataLackCheckLevel}");
            result.AppendLine($"- Trạng thái trùng lặp: {(duplicateState == "0" ? "Không có bộ nhận trùng lặp" : "Có bộ nhận trùng lặp")}");

            // Process noise levels for band IDs 11-25
            result.AppendLine("- Mức độ nhiễu của các băng tần:");
            int startIndex = 19;
            string firstNoiseLevel = data.Substring(startIndex, 3);
            bool allSameValue = true;

            // Check if all values are the same
            for (int bandIdNum = 11; bandIdNum <= 25; bandIdNum++)
            {
                var noiseLevel = data.Substring(startIndex, 3);
                if (noiseLevel != firstNoiseLevel)
                {
                    allSameValue = false;
                    break;
                }
                startIndex += 3;
            }

            // Reset startIndex for actual output
            startIndex = 19;

            if (allSameValue)
            {
                result.AppendLine($"  + Băng tần 11-25: {firstNoiseLevel}");
            }
            else
            {
                for (int bandIdNum = 11; bandIdNum <= 25; bandIdNum++)
                {
                    var noiseLevel = data.Substring(startIndex, 3);
                    result.AppendLine($"  + Băng tần {bandIdNum}: {noiseLevel}");
                    startIndex += 3;
                }
            }

            return result.ToString();
        }

        private string ProcessTransmitterStatusString(string data)
        {
            // ST10007010001547801
            // 1: API version
            // 00: group id
            // 01: channel
            // 000154780: device id
            // 01: status code
            // var groupId = data.Substring(3, 2);
            // var channel = data.Substring(5, 2);
            var deviceId = data.Substring(7, 10);
            var statusCode = data.Substring(17, 2);

            var message = statusCode switch
            {
                "00" => $"Thông báo từ thiết bị đo ID:{deviceId}: thước đo báo pin yếu",
                "01" => $"Thông báo từ thiết bị đo ID:{deviceId}: thước đo không phản hồi",
                "02" => $"Phát hiện thiết bị đo ID:{deviceId}: chưa được đăng ký",
                "03" => $"Thông báo từ thiết bị đo ID:{deviceId}: bị mất dữ liệu đo",
                "04" => $"Thông báo từ thiết bị đo ID:{deviceId}: bị mất kết nối",
                "05" => $"Dữ liệu của thiết bị đo ID:{deviceId}: đã được xóa",
                "50" => $"Lỗi gói tin yêu cầu từ thiết bị đo ID:{deviceId}",
                "51" => $"Không tìm thấy thiết bị đo ID:{deviceId}",
                "99" => $"Thông báo từ thiết bị đo ID:{deviceId}: đã hủy dữ liệu",
                _ => $"Thông báo từ thiết bị đo ID:{deviceId}: gửi mã trạng thái không xác định: {statusCode}"
            };

            return message;
        }

        // private void ProcessReceivedData(string data)
        // {
        //     // Remove any non-printable characters and trim
        //     data = data.Trim('\0').Trim();

        //     _logger.LogInformation("FOUND RESPONSE: " + data);

        //     // Analyze the received data based on the company's documentation
        //     if (data.StartsWith("DT"))
        //     {
        //         // Measurement data packet
        //         ParseMeasurementData(data);
        //     }
        //     else if (data.StartsWith("ST"))
        //     {
        //         // Status packet
        //         ParseStatusPacket(data);
        //     }
        //     else if (data.StartsWith("RI"))
        //     {
        //         // U-WAVE-R information packet
        //         ParseUWaveRInfoPacket(data);
        //     }
        //     else if (data.StartsWith("TI"))
        //     {
        //         // U-WAVE-T information packet
        //         ParseUWaveTInfoPacket(data);
        //     }
        //     else
        //     {
        //         // Unknown data
        //         // Log or handle as needed
        //         _logger.LogInformation("Unknown data received: " + data);
        //     }
        // }

        private string ProcessMeasurementData(string data)
        {
            try
            {
                // DT10007+00000028.87M

                // DT: measurement data packet
                // 1: API version
                // 00: group id
                // 07: channel
                // +: sign
                // 00000028.87: measurement data
                // M: Unit M/I/0 : M=mm, I=Inch, 0=No unit
                // Terminator 0Dh 1 CR(Carriage return)
                // total 21 bytes
                string payload = data.Substring(2).TrimEnd('\r', '\n');

                // Log the payload and its length for debugging
                _logger.LogInformation($"Payload: '{payload}', Length: {payload.Length}");

                // Ensure payload has the expected length
                if (payload.Length >= 18)
                {
                    string version = payload.Substring(0, 1);
                    string groupId = payload.Substring(1, 2);
                    string channel = payload.Substring(3, 2);
                    string sign = payload.Substring(5, 1);
                    string measurementData = payload.Substring(6, 11).Trim();
                    string unit = payload.Substring(17, 1);

                    // Build the output data according to the sign
                    string outputData;
                    if (sign == "+")
                    {
                        outputData = measurementData;
                    }
                    else if (sign == "-")
                    {
                        outputData = sign + measurementData;
                    }
                    else
                    {
                        _logger.LogInformation("Invalid sign in measurement data.");
                        return "";
                    }

                    // Display or process the measurement data as needed
                    _logger.LogInformation($"Measurement Received: {outputData}");
                    return outputData;
                }
                else
                {
                    _logger.LogInformation($"Invalid measurement data packet length: {payload.Length}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogInformation("Error parsing measurement data: " + ex.Message);
            }
            return "";
        }


        // private void ParseStatusPacket(string data)
        // {
        //     try
        //     {
        //         string payload = data.Substring(2).TrimEnd('\r');

        //         if (payload.Length >= 18)
        //         {
        //             string version = payload.Substring(0, 1);
        //             string groupId = payload.Substring(1, 2);
        //             string channel = payload.Substring(3, 2);
        //             string deviceId = payload.Substring(5, 10);
        //             string statusCode = payload.Substring(15, 2);

        //             // Display or process the status code as needed
        //             _logger.LogInformation($"Status Packet Received: Status Code: {statusCode}");
        //         }
        //         else
        //         {
        //             _logger.LogInformation("Invalid status packet length.");
        //         }
        //     }
        //     catch (Exception ex)
        //     {
        //         _logger.LogInformation("Error parsing status packet: " + ex.Message);
        //     }
        // }

        private void ParseUWaveRInfoPacket(string data)
        {
            // Implement parsing based on the documentation
            // Since the U-WAVE-R information packet is longer, ensure to handle it properly
        }

        private void ParseUWaveTInfoPacket(string data)
        {
            // Implement parsing based on the documentation
        }

        // public void SendMeasurementRequest()
        // {
        //     if (_connectedPort != null && _connectedPort.IsOpen)
        //     {
        //         // Request measurement data from all U-WAVE-T devices
        //         _comPortService.
        //         // Optionally, notify the user
        //         _logger.LogInformation("Measurement data request sent.");
        //     }
        //     else
        //     {
        //         _logger.LogInformation("Serial port is not open.");
        //     }
        // }

        public void RegisterEvents(BrowserWindow window)
        {
            _window = window;

            Electron.IpcMain.On("get-current-serial-port", (args) =>
            {
                _logger.LogInformation("Getting current serial port");
                Electron.IpcMain.Send(window, "current-serial-port", GetCurrentSerialPort());
            });

            // Electron.IpcMain.On("set-current-serial-port", (args) =>
            // {
            //     if (args != null)
            //     {
            //         _logger.LogInformation("Setting current serial port to " + args);
            //         // SetCurrentSerialPort(args.ToString());
            //     }
            // });

            Electron.IpcMain.On("get-available-serial-ports", (args) =>
            {
                Electron.IpcMain.Send(window, "available-serial-ports", GetAvailableSerialPorts());
            });

            Electron.IpcMain.On("get-current-serial-port-info", (args) =>
            {
                Electron.IpcMain.Send(window, "current-serial-port-info", GetCurrentSerialPortInfo());
            });

            Electron.IpcMain.On("check-receiver-info", async (args) =>
            {
                await SendReceiverStatusRequest();
            });

            Electron.IpcMain.On("connect-to-serial-port", async (args) =>
            {
                _logger.LogInformation("Connecting to serial port " + args);
                await ConnectToPortByName(args.ToString() ?? "");
            });

            Electron.IpcMain.On("close-serial-port", async (args) =>
            {
                _logger.LogInformation("Closing serial port");
                await CloseSerialPort();
            });
        }

        private async Task CloseSerialPort()
        {
            await _comPortService.DisconnectAsync();
            _connectedPort = null;
        }

        public async Task SendReceiverStatusRequest()
        {
            _logger.LogInformation("Sending receiver status request");
            await _comPortService.SendReceiverStatusRequest();
        }

        public string GetCurrentSerialPort()
        {
            return _comPortService.GetCurrentPortName();
        }

        public async Task ConnectToPortByName(string port)
        {
            if (string.IsNullOrEmpty(port))
            {
                Electron.IpcMain.Send(_window, "connect-to-serial-port-result", false);
                return;
            }
            _logger.LogInformation("Connecting to serial port " + port);
            var result = await _comPortService.ConnectUsingDefaultSettingsAsync(port);
            // todo: send result to main window and it should handle the cant connect result
            Electron.IpcMain.Send(_window, "connect-to-serial-port-result", result);
            _logger.LogInformation("Connected to serial port " + port + " with result " + result);
            _connectedPort = _comPortService.GetConnectedPort();
            Electron.IpcMain.Send(_window, "current-serial-port", GetCurrentSerialPort());
        }

        public string GetCurrentSerialPortInfo()
        {
            return _comPortService.GetCurrentPortInfo();
        }

        // public string CheckReceiverInfo()
        // {
        //     // todo: implement this
        //     SendStatusRequest();

        //     return "";
        // }

        // public void SetCurrentSerialPort(string port)
        // {
        //     _comPortService.ConnectToPortByName(port);
        // }

        public string[] GetAvailableSerialPorts()
        {
            return _comPortService.GetAvailablePorts();
        }

        // Add this to HardwareService if you need cleanup
        public void Dispose()
        {
            _comPortService.MeasurementDataReceived -= OnMeasurementDataReceived;
            _comPortService.ReceiverStatusReceived -= OnReceiverStatusReceived;
            _comPortService.TransmitterInfoReceived -= OnTransmitterInfoReceived;
            _comPortService.GenericDataReceived -= OnGenericDataReceived;
            _comPortService.CommandError -= OnCommandError;
        }
    }
}
